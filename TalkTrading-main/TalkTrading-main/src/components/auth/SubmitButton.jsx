import { authColors } from './AuthLayout'

export default function SubmitButton({ submitting, label, busyLabel }) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="w-full rounded-xl py-3 text-sm font-semibold transition-opacity active:scale-[0.98] disabled:opacity-60"
      style={{ background: `linear-gradient(135deg, ${authColors.gold}, ${authColors.goldDeep})`, color: '#3C2F00' }}
    >
      {submitting ? busyLabel : label}
    </button>
  )
}
