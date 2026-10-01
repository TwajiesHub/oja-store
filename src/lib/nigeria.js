// The 36 states and the Federal Capital Territory. Keep in step with STATES in api/nigeria.py
// (a backend test checks that list has 37 entries). The server validates again regardless.
export const STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River',
  'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
  'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

// 0803..., 234803... or +234803...: a mobile number is 10 digits after the country code.
const PHONE = /^(?:\+?234|0)[789][01]\d{8}$/

export function isNigerianPhone(value) {
  return PHONE.test(value.replace(/[\s\-().]/g, ''))
}

// Checks the delivery form the same way the server does, so mistakes show before paying.
export function validateDelivery(values) {
  const errors = {}
  if (values.full_name.trim().length < 2) errors.full_name = 'Enter your full name'
  if (!isNigerianPhone(values.phone)) errors.phone = 'Enter a Nigerian mobile number, like 0803 000 0000'
  if (values.address.trim().length < 5) errors.address = 'Enter your street address'
  if (values.area.trim().length < 2) errors.area = 'Enter your area or LGA'
  if (!STATES.includes(values.state)) errors.state = 'Choose a state'
  return errors
}

// +2348030000000 shown as +234 803 000 0000. Anything else is shown as it is.
export function formatPhone(phone) {
  return /^\+234\d{10}$/.test(phone) ? `+234 ${phone.slice(4, 7)} ${phone.slice(7, 10)} ${phone.slice(10)}` : phone
}
