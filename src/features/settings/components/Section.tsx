import type { ReactNode } from 'react'
import styles from './Section.module.css'

interface SectionProps {
  title: string
  desc?: string
  children: ReactNode
}

export function Section({ title, desc, children }: SectionProps) {
  return (
    <section className={styles.section}>
      <h3 className={styles.title}>{title}</h3>
      {desc && <p className={styles.desc}>{desc}</p>}
      <div className={styles.content}>{children}</div>
    </section>
  )
}
