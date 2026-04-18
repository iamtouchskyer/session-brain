import { useLang, setLang } from '../lib/router'
import { useT } from '../lib/i18n'
import type { Lang } from '../pipeline/types'

/**
 * LangToggle — two-state pill toggle between zh and en.
 * Sits next to ThemeToggle in the header.
 */
export function LangToggle() {
  const lang = useLang()
  const t = useT()

  const options: Lang[] = ['zh', 'en']

  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      {options.map((l) => {
        const isActive = l === lang
        const labelKey = l === 'zh' ? 'lang.zh' : 'lang.en'
        const label = t(labelKey)
        return (
          <button
            key={l}
            type="button"
            className={`lang-toggle__btn${isActive ? ' lang-toggle__btn--active' : ''}`}
            aria-pressed={isActive}
            aria-label={t('lang.switchTo', { lang: label })}
            onClick={() => { if (!isActive) setLang(l) }}
          >
            {l.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}
