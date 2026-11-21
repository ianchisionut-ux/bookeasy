import Image from 'next/image'
import styles from './integrations-marquee.module.css'

const integrations = [
  { name: 'Google', logo: 'google.svg', width: 270, height: 82 },
  { name: 'Meta', logo: 'meta.svg', width: 948, height: 191 },
  { name: 'Instagram', logo: 'instagram.svg', width: 24, height: 24, showName: true },
  { name: 'Facebook', logo: 'facebook.svg', width: 24, height: 24, showName: true },
  { name: 'WhatsApp', logo: 'whatsapp.svg', width: 32, height: 32, showName: true },
  { name: 'Banca Transilvania', logo: 'banca-transilvania.svg', width: 300, height: 56 },
]

export function IntegrationsMarquee() {
  return (
    <section className={styles.strip} aria-labelledby="bookeasy-integrations-title">
      <div className={styles.inner}>
        <h2 className={styles.heading} id="bookeasy-integrations-title">Integrări</h2>
        <div className={styles.viewport}>
          <div className={styles.track}>
            {[false, true].map((duplicate) => (
              <ul key={String(duplicate)} className={styles.logos} aria-hidden={duplicate || undefined}>
                {integrations.map(({ name, logo, width, height, showName }) => (
                  <li key={logo} className={styles.item}>
                    <Image
                      src={`/integrations/${logo}`}
                      alt={duplicate || showName ? '' : name}
                      width={width}
                      height={height}
                      className={styles.logo}
                    />
                    {showName && <span className={styles.logoName}>{name}</span>}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
