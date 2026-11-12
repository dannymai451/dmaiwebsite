import Frame from './Frame'
import { workPage } from './work'
import './Work.css'

function Arrow({ direction }) {
  const left = direction === 'left'
  return (
    <svg className={`work-arrow is-${direction}`} viewBox="0 0 64 52" aria-hidden="true">
      <path
        d={left ? 'M60 6 C 46 12, 34 22, 22 36' : 'M4 6 C 18 12, 30 22, 42 36'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.7"
        strokeLinecap="round"
      />
      <path d={left ? 'M8 46 L 28 40 L 16 20 Z' : 'M56 46 L 36 40 L 48 20 Z'} fill="currentColor" />
    </svg>
  )
}

function Tape({ tone }) {
  return (
    <svg className={`work-tape is-${tone}`} viewBox="0 0 148 46" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 16c6-8 16-5 26-7 14-3 18 7 32 5 16-3 20-9 36-7 12 2 18 7 28 5 5-1 10 3 12 7l-3 14c-8 5-16 1-24 4-14 4-18-5-32-3-16 3-22 9-36 7-10-2-18-7-28-5-6 1-10-2-11-6z"
      />
      <path
        fill="#fff"
        opacity="0.35"
        d="M22 16c12-3 16 4 28 2 10-1 14-5 24-4"
        stroke="none"
      />
    </svg>
  )
}

function Pin({ tone }) {
  return (
    <svg className={`work-pin is-${tone}`} viewBox="0 0 48 68" aria-hidden="true">
      <ellipse cx="24" cy="20" rx="16" ry="14" fill="currentColor" />
      <ellipse cx="17" cy="14" rx="6" ry="4" fill="#fff" opacity="0.5" />
      <path d="M21.5 32h5l1.2 28h-7.4z" fill="#d7dbe0" />
      <ellipse cx="24" cy="32" rx="6.5" ry="3" fill="#16324a" opacity="0.28" />
    </svg>
  )
}

function Hold({ hold }) {
  if (hold.kind === 'pin') return <Pin tone={hold.tone} />
  return <Tape tone={hold.tone} />
}

function CardLink({ link }) {
  const body = (
    <>
      {link.label}
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M3.2 8.8 L8.8 3.2 M5 3.2 H8.8 V7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  )
  if (link.href) {
    return (
      <a className="work-link" href={link.href}>
        {body}
      </a>
    )
  }
  return <span className="work-link">{body}</span>
}

function Polaroid({ card }) {
  return (
    <div className="polaroid-slot">
      <article className={`polaroid is-${card.kind}`} style={{ '--tilt': `${card.tilt}deg` }}>
        <Hold hold={card.hold} />
        <div className="polaroid-media">
          {card.image ? <img src={card.image} alt={card.media} /> : <span>{card.media}</span>}
        </div>
        {card.kind === 'job' ? (
          <div className="polaroid-caption">
            <div className="polaroid-head">
              <p className="polaroid-company">{card.company}</p>
              <span className="work-badge">{card.badge}</span>
            </div>
            <p className="polaroid-meta">
              {card.role} · {card.dates}
            </p>
          </div>
        ) : (
          <div className="polaroid-caption">
            <p className="polaroid-name">{card.title}</p>
            <p className="polaroid-desc">{card.description}</p>
            <p className="polaroid-links">
              {card.links.map((link) => (
                <CardLink key={link.label} link={link} />
              ))}
            </p>
          </div>
        )}
      </article>
    </div>
  )
}

function Note({ note }) {
  return (
    <div className="work-note-slot">
      <div className="work-note">
        <p className="work-note-title">{note.title}</p>
        <ul>
          {note.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Column({ column, cards }) {
  return (
    <div className={`work-col is-${column.id}`}>
      <div className="work-stack">
        <p className="work-label">
          {column.arrow === 'left' ? <Arrow direction="left" /> : null}
          <span>{column.label}</span>
          {column.arrow === 'right' ? <Arrow direction="right" /> : null}
        </p>
        <div className="work-cluster">
          {cards.map((card) => (
            <Polaroid key={card.id} card={card} />
          ))}
          {column.note ? <Note note={column.note} /> : null}
        </div>
        {column.more ? <p className="work-more">{column.more}</p> : null}
      </div>
    </div>
  )
}

export default function Work() {
  const columns = workPage.columns
  return (
    <section className="work" aria-labelledby="work-title">
      <div className="work-box">
        <div className="work-reveal">
          <Frame paper="transparent" width="100%" height="100%" />
          <div className="work-layout">
            <h2 className="work-title" id="work-title">
              <svg className="work-mark" viewBox="0 0 520 80" preserveAspectRatio="none" aria-hidden="true">
                <path
                  d="M12 46C90 24 170 68 270 40 360 16 430 64 508 34"
                  fill="none"
                  stroke="#f0cc3d"
                  strokeWidth="30"
                  strokeLinecap="round"
                />
                <path
                  d="M20 36C110 58 190 22 290 50 380 72 450 28 500 48"
                  fill="none"
                  stroke="#ffe98a"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
              </svg>
              <span>{workPage.title}</span>
            </h2>
            <div className="work-board">
              {columns.flatMap((column, index) => {
                const block = (
                  <Column
                    key={column.id}
                    column={column}
                    cards={workPage.cards.filter((card) => card.column === column.id)}
                  />
                )
                if (index === 0) return [block]
                return [
                  <div key={`${column.id}-rule`} className="work-rule" aria-hidden="true" />,
                  block,
                ]
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
