// The clinic runs on Vietnam time, while the containers run on UTC: always derive "today"/"now" here.
export const CLINIC_TZ = 'Asia/Ho_Chi_Minh';

const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TZ }); // → YYYY-MM-DD
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLINIC_TZ,
  hour: '2-digit',
  minute: '2-digit',
});

/** 'YYYY-MM-DD' of `date` in clinic time. */
export const clinicDate = (date = new Date()) => dateFormat.format(date);

/** 'HH:mm' of `date` in clinic time. */
export const clinicTime = (date = new Date()) => timeFormat.format(date);
