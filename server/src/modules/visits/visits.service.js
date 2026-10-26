import { withTransaction } from '../../db/mssql.js';
import { HttpError, notFound } from '../../utils/http-error.js';
import * as repo from './visits.repository.js';

/** Doctors only see their own visits. */
export function list(query, user) {
  return repo.findAll(user.role === 'DOCTOR' ? { ...query, doctorId: user.doctorId } : query);
}

/** FR6: nest the flat join rows into visit → patient/doctor/appointment/prescription/invoice. */
export async function get(id) {
  const rows = await repo.findDetailRows(id);
  if (!rows.length) throw notFound('lượt khám');
  const r = rows[0];
  return {
    id: r.visit_id,
    visitDate: r.visit_date,
    symptoms: r.symptoms,
    diagnosis: r.diagnosis,
    notes: r.notes,
    patient: {
      id: r.patient_id,
      fullName: r.patient_name,
      dateOfBirth: r.date_of_birth,
      gender: r.gender,
      phone: r.patient_phone,
      bloodType: r.blood_type,
      medicalHistory: r.medical_history,
    },
    doctor: { id: r.doctor_id, fullName: r.doctor_name, specialization: r.specialization },
    department: { id: r.department_id, name: r.department_name, location: r.department_location },
    appointment: r.appointment_id
      ? { id: r.appointment_id, reason: r.appointment_reason, date: r.slot_date, time: r.slot_time }
      : null,
    prescription: r.prescription_id
      ? {
          id: r.prescription_id,
          notes: r.prescription_notes,
          items: rows
            .filter((x) => x.medicine_id)
            .map((x) => ({
              medicineId: x.medicine_id,
              name: x.medicine_name,
              unit: x.unit,
              quantity: x.quantity,
              dosage: x.dosage,
              unitPrice: x.unit_price,
              amount: x.quantity * x.unit_price,
            })),
        }
      : null,
    invoice: r.invoice_id
      ? {
          id: r.invoice_id,
          consultationFee: r.consultation_fee,
          medicineTotal: r.medicine_total,
          totalAmount: r.total_amount,
          status: r.invoice_status,
          issuedAt: r.issued_at,
          paidAt: r.paid_at,
        }
      : null,
  };
}

/**
 * FR4: record a visit = visit + prescription + items + stock decrement + invoice + close appointment,
 * all in ONE transaction (topic iv). Any failure (e.g. out of stock) rolls everything back.
 */
export async function create(input, user) {
  const doctorId = user.role === 'DOCTOR' ? user.doctorId : input.doctorId;
  if (!doctorId) throw new HttpError(400, 'Thiếu bác sĩ khám');

  const visitId = await withTransaction(async (tx) => {
    if (input.appointmentId) {
      const appt = await repo.lockAppointment(tx, input.appointmentId);
      if (!appt) throw notFound('lịch hẹn');
      if (appt.status !== 'SCHEDULED')
        throw new HttpError(409, `Lịch hẹn không ở trạng thái chờ khám (${appt.status})`);
      if (appt.patientId !== input.patientId) throw new HttpError(400, 'Bệnh nhân không khớp với lịch hẹn');
      if (appt.doctorId !== doctorId) throw new HttpError(403, 'Lịch hẹn này thuộc bác sĩ khác');
    }
    const doctor = await repo.doctorFee(tx, doctorId);
    if (!doctor?.active) throw new HttpError(409, 'Bác sĩ không tồn tại hoặc đã ngừng hoạt động');

    const id = await repo.insertVisit(tx, { ...input, doctorId });

    let medicineTotal = 0;
    if (input.items.length) {
      const prescriptionId = await repo.insertPrescription(tx, id, input.prescriptionNotes);
      for (const item of input.items) {
        const dispensed = await repo.dispense(tx, item.medicineId, item.quantity);
        if (!dispensed) {
          const med = await repo.medicineStock(tx, item.medicineId);
          if (!med) throw notFound(`thuốc #${item.medicineId}`);
          throw new HttpError(
            409,
            `Thuốc "${med.name}" không đủ tồn kho (còn ${med.stock}, cần ${item.quantity})`,
          );
        }
        await repo.insertItem(tx, { ...item, prescriptionId, unitPrice: dispensed.unitPrice });
        medicineTotal += item.quantity * dispensed.unitPrice;
      }
    }

    await repo.insertInvoice(tx, { visitId: id, consultationFee: doctor.fee, medicineTotal });
    if (input.appointmentId) await repo.completeAppointment(tx, input.appointmentId);
    return id;
  });
  return get(visitId);
}

export async function payInvoice(id) {
  if (await repo.payInvoice(id)) return get((await repo.invoiceVisitId(id)).visitId);
  const invoice = await repo.invoiceVisitId(id);
  if (!invoice) throw notFound('hoá đơn');
  throw new HttpError(409, `Hoá đơn đang ở trạng thái ${invoice.status}`);
}
