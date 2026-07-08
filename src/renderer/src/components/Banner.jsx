/**
 * Banner di stato (successo/errore/info) annunciato agli screen reader
 * (WCAG 4.1.3 "Status Messages"): gli errori interrompono con aria-live
 * assertive, gli altri esiti usano polite.
 */
export default function Banner({ type = 'info', children, style }) {
  return (
    <div
      className={`alert alert-${type}`}
      role="status"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      style={style}
    >
      {children}
    </div>
  )
}
