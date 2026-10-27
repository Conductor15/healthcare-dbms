import dayjs from 'dayjs';

export const money = (v) => (v == null ? '—' : `${Number(v).toLocaleString('vi-VN')} ₫`);
export const fmtDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');
export const fmtDateTime = (d) => (d ? dayjs(d).format('DD/MM/YYYY HH:mm') : '—');
export const fmtTime = (d) => (d ? dayjs(d).format('HH:mm:ss') : '—');
export const toIsoDate = (d) => (d ? dayjs(d).format('YYYY-MM-DD') : undefined);

export const GENDER = { M: 'Nam', F: 'Nữ', O: 'Khác' };

export const APPOINTMENT_STATUS = {
  SCHEDULED: { color: 'blue', label: 'Chờ khám' },
  COMPLETED: { color: 'green', label: 'Đã khám' },
  CANCELLED: { color: 'default', label: 'Đã huỷ' },
  NO_SHOW: { color: 'orange', label: 'Không đến' },
};

export const INVOICE_STATUS = {
  UNPAID: { color: 'gold', label: 'Chưa thanh toán' },
  PAID: { color: 'green', label: 'Đã thanh toán' },
  VOID: { color: 'default', label: 'Đã huỷ' },
};

export const ROLE_LABEL = { ADMIN: 'Quản trị', RECEPTIONIST: 'Lễ tân', DOCTOR: 'Bác sĩ' };

export const age = (dateOfBirth) => (dateOfBirth ? dayjs().diff(dayjs(dateOfBirth), 'year') : null);
