import { sql, withTransaction } from '../../db/mssql.js';
import { clinicDate, clinicTime } from '../../utils/clinic-time.js';
import { HttpError, notFound } from '../../utils/http-error.js';
import * as repo from './appointments.repository.js';

const UNIQUE_VIOLATION = [2627, 2601];

export const slots = (query) => repo.findSlots(query);

/** Doctors only ever see their own schedule. */
export function list(query, user) {
  return repo.findAll(user.role === 'DOCTOR' ? { ...query, doctorId: user.doctorId } : query);
}

export async function get(id) {
  const appointment = await repo.findById(id);
  if (!appointment) throw notFound('lịch hẹn');
  return appointment;
}

/**
 * FR3: book a slot in ONE transaction (topic iv) that serialises concurrent bookings of the
 * same slot with UPDLOCK + HOLDLOCK (topic v). The filtered UNIQUE index on appointments(slot_id)
 * is the last line of defence.
 */
export async function book({ patientId, slotId, reason }, user) {
  try {
    const id = await withTransaction(async (tx) => {
      const slot = await repo.lockSlot(tx, slotId);
      if (!slot) throw notFound('khung giờ');
      if (!slot.doctorActive) throw new HttpError(409, 'Bác sĩ đã ngừng nhận lịch');
      const today = clinicDate();
      if (slot.date < today || (slot.date === today && slot.startTime <= clinicTime())) {
        throw new HttpError(400, 'Không thể đặt khung giờ đã qua');
      }
      if (slot.isBooked) throw new HttpError(409, 'Khung giờ này vừa có người đặt, vui lòng chọn giờ khác');
      if (!(await repo.patientExists(tx, patientId))) throw notFound('bệnh nhân');
      const clash = await repo.patientBusyAt(tx, { patientId, date: slot.date, startTime: slot.startTime });
      if (clash) throw new HttpError(409, `Bệnh nhân đã có lịch hẹn #${clash.id} cùng giờ`);
      return repo.insert(tx, { patientId, slotId, reason, createdBy: user.sub });
    }, sql.ISOLATION_LEVEL.READ_COMMITTED);
    return repo.findById(id);
  } catch (err) {
    if (UNIQUE_VIOLATION.includes(err.number)) {
      throw new HttpError(409, 'Khung giờ này vừa có người đặt, vui lòng chọn giờ khác');
    }
    throw err;
  }
}

export async function cancel(id) {
  await withTransaction(async (tx) => {
    const appointment = await repo.lockAppointment(tx, id);
    if (!appointment) throw notFound('lịch hẹn');
    if (appointment.status !== 'SCHEDULED') {
      throw new HttpError(409, `Chỉ huỷ được lịch đang chờ khám (hiện tại: ${appointment.status})`);
    }
    await repo.cancel(tx, appointment);
  });
  return repo.findById(id);
}

export async function remove(id) {
  if (await repo.removeCancelled(id)) return;
  await get(id); // 404 if it does not exist
  throw new HttpError(409, 'Chỉ xoá được lịch hẹn đã huỷ');
}
