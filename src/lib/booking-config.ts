export const bookingConfig = {
  ownerEmail: process.env.MS_BOOKING_OWNER_EMAIL || "keeranj@kjagsadvisors.com",
  timezone: process.env.BOOKING_TIMEZONE || "America/New_York",
  businessStartHour: parseInt(process.env.BOOKING_BUSINESS_START_HOUR || "9", 10),
  businessEndHour: parseInt(process.env.BOOKING_BUSINESS_END_HOUR || "17", 10),
  slotMinutes: parseInt(process.env.BOOKING_SLOT_MINUTES || "30", 10),
  bufferMinutes: parseInt(process.env.BOOKING_BUFFER_MINUTES || "15", 10),
  minNoticeHours: parseInt(process.env.BOOKING_MIN_NOTICE_HOURS || "24", 10),
  maxDaysAhead: parseInt(process.env.BOOKING_MAX_DAYS_AHEAD || "14", 10),
  weekdaysOnly: true,
};
