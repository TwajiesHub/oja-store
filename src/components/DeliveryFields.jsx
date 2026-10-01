import { formatNaira } from '../lib/money.js'
import { STATES } from '../lib/nigeria.js'

function Field({ id, label, error, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && <p id={`${id}-error`} className="field__error" role="alert">{error}</p>}
    </div>
  )
}

function SpeedOption({ speed, title, detail, option, checked, onChange }) {
  const available = option ? option.available : true
  const fee = !option || option.fee_kobo === null ? '' : option.fee_kobo === 0 ? 'Free' : formatNaira(option.fee_kobo)
  return (
    <label className={`speed-option${checked ? ' speed-option--on' : ''}${available ? '' : ' speed-option--off'}`}>
      <input type="radio" name="delivery_speed" value={speed} checked={checked} disabled={!available} onChange={() => onChange(speed)} />
      <span className="speed-option__text">
        <strong>{title}</strong>
        <span>{available ? detail : 'Lagos only'}</span>
      </span>
      <span className="speed-option__fee">{fee}</span>
    </label>
  )
}

// Contact and delivery inputs for checkout. Values and errors live in the page.
export default function DeliveryFields({ values, errors, options, onChange }) {
  const input = (name, extra = {}) => ({
    id: name,
    name,
    value: values[name],
    onChange: (event) => onChange(name, event.target.value),
    'aria-invalid': errors[name] ? 'true' : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
    ...extra,
  })
  const optionFor = (speed) => options?.find((o) => o.speed === speed)
  const lagos = values.state === 'Lagos'

  return (
    <>
      <div className="form-grid">
        <Field id="full_name" label="Full name" error={errors.full_name}>
          <input type="text" autoComplete="name" {...input('full_name')} />
        </Field>
        <Field id="phone" label="Phone number" error={errors.phone}>
          <input type="tel" autoComplete="tel" placeholder="+234 803 000 0000" {...input('phone')} />
        </Field>
      </div>
      <Field id="address" label="Street address" error={errors.address}>
        <input type="text" autoComplete="street-address" {...input('address')} />
      </Field>
      <div className="form-grid">
        <Field id="area" label="Area or LGA" error={errors.area}>
          <input type="text" autoComplete="address-level2" {...input('area')} />
        </Field>
        <Field id="state" label="State" error={errors.state}>
          <select autoComplete="address-level1" {...input('state')}>
            {STATES.map((state) => <option key={state} value={state}>{state}</option>)}
          </select>
        </Field>
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={values.save_address}
          onChange={(event) => onChange('save_address', event.target.checked)}
        />
        Save this address for next time
      </label>

      <fieldset className="speed-options">
        <legend className="label">Delivery speed</legend>
        <SpeedOption
          speed="standard"
          title={`Standard · ${lagos ? '1 to 3 days' : '3 to 5 days'}`}
          detail={lagos ? 'Free in Lagos on orders over ₦50,000' : 'Delivered across Nigeria'}
          option={optionFor('standard')}
          checked={values.delivery_speed === 'standard'}
          onChange={(speed) => onChange('delivery_speed', speed)}
        />
        <SpeedOption
          speed="express"
          title="Express · same day"
          detail="Order by 12:00 WAT, Lagos only"
          option={optionFor('express')}
          checked={values.delivery_speed === 'express'}
          onChange={(speed) => onChange('delivery_speed', speed)}
        />
      </fieldset>
    </>
  )
}
