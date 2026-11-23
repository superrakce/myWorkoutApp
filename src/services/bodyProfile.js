// Rebase legacy profile ages to the one date shown in the measurement form.
export function profileAtMeasurement(profile, dateTime) {
  const date = String(dateTime || '').slice(0, 10)
  const valid = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  if (!valid(date)) return { ...profile }
  const reference = profile.ageDate
  let age = profile.age
  if (age != null && age !== '' && Number.isFinite(Number(age)) && valid(reference)) {
    let years = Number(date.slice(0, 4)) - Number(reference.slice(0, 4))
    if (date.slice(5) < reference.slice(5)) years--
    age = Number(age) + years
  }
  return { ...profile, age, ageDate: date }
}
