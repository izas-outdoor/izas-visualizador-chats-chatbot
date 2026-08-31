import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ReferenceDot
} from 'recharts'
import { useSessions } from './useSessions'
import { computeStats, FEEDBACK_YES, FEEDBACK_NO } from './stats'

// Un único hue de marca para todas las gráficas de una sola serie (magnitud /
// tendencia): la identidad ya la da el eje, así que el color no necesita
// distinguir nada más. El rojo solo se usa para el "No" del feedback, que es
// una señal de estado (bien/mal), no una serie más.
const GREEN = '#2ecc71'
const RED = '#ef4444'
const INK = '#27332c'
const MUTED = '#7c8a80'
const GRID = '#e7ece8'

const numberFmt = new Intl.NumberFormat('es-ES')
const fmt = (n) => numberFmt.format(n)

function ChartTooltip({ active, payload, label, swatch = GREEN }) {
  if (!active || !payload || !payload.length) return null
  const point = payload[0].payload
  const value = payload[0].value
  const name = point?.name ?? label
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip-key" style={{ background: swatch }} />
      <span className="chart-tooltip-value">{fmt(value)}</span>
      <span className="chart-tooltip-label">{name}</span>
    </div>
  )
}

// Tarjeta reutilizable: cada gráfica trae su "gemela" en tabla (accesibilidad
// y para poder leer valores exactos sin tener que pasar el ratón).
function ChartCard({ title, subtitle, table, children }) {
  const [showTable, setShowTable] = useState(false)
  return (
    <div className="stats-card">
      <div className="stats-card-header">
        <div>
          <h3 className="stats-card-title">{title}</h3>
          {subtitle && <p className="stats-card-subtitle">{subtitle}</p>}
        </div>
        {table && (
          <button type="button" className="table-toggle-btn" onClick={() => setShowTable(v => !v)}>
            {showTable ? 'Ver gráfica' : 'Ver tabla'}
          </button>
        )}
      </div>
      {showTable && table ? (
        <div className="stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr><th>{table.labelHeader}</th><th>{table.valueHeader}</th></tr>
            </thead>
            <tbody>
              {table.rows.map(r => (
                <tr key={r.label}><td>{r.label}</td><td>{fmt(r.value)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : children}
    </div>
  )
}

function KpiTile({ value, label, alert }) {
  return (
    <div className={`kpi-tile ${alert ? 'kpi-alert' : ''}`}>
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
    </div>
  )
}

// Gráfica de tendencia (día de semana / hora / mes): área + línea suave de
// una sola serie, con el pico marcado y etiquetado (el resto de puntos no
// llevan número encima para no saturar).
function TrendChart({ data, xKey, labelKey = 'label' }) {
  const peak = useMemo(() => {
    if (data.length === 0) return null
    return data.reduce((max, d) => (d.count > max.count ? d : max), data[0])
  }, [data])

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GREEN} stopOpacity={0.22} />
            <stop offset="100%" stopColor={GREEN} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" vertical={false} stroke={GRID} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          width={38}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ stroke: '#c3cbc5', strokeWidth: 1 }}
          content={<ChartTooltip />}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke={GREEN}
          strokeWidth={2}
          fill="url(#trendFill)"
          dot={false}
          activeDot={{ r: 5, fill: GREEN, stroke: '#fff', strokeWidth: 2 }}
          isAnimationActive={false}
        />
        {peak && peak.count > 0 && (
          <ReferenceDot
            x={peak[xKey]}
            y={peak.count}
            r={5}
            fill={GREEN}
            stroke="#fff"
            strokeWidth={2}
            label={{ value: fmt(peak.count), position: 'top', fontSize: 11, fontWeight: 700, fill: INK }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default function StatsPage() {
  const { sessions, loading, error } = useSessions()
  const stats = useMemo(() => computeStats(sessions), [sessions])

  const totalFeedback = stats.feedback.yes + stats.feedback.no
  const pctYes = totalFeedback > 0 ? Math.round((stats.feedback.yes / totalFeedback) * 100) : null

  return (
    <div className="stats-page">
      <div className="chat-header">
        <h2 className="stats-title">📊 Estadísticas</h2>
      </div>

      <div className="stats-body">
        {error && <div className="list-state list-error"><p>⚠️ {error}</p></div>}

        {!error && loading && (
          <div className="list-state">
            <div className="spinner" />
            <p>Cargando estadísticas…</p>
          </div>
        )}

        {!error && !loading && (
          <>
            <div className="stats-kpis">
              <KpiTile value={fmt(stats.totalSessions)} label="Conversaciones" />
              <KpiTile value={fmt(stats.totalUserMessages)} label="Mensajes de usuarios" />
              <KpiTile value={fmt(stats.derivaciones)} label="Derivaciones a agente" alert={stats.derivaciones > 0} />
              <KpiTile value={pctYes === null ? '—' : `${pctYes}%`} label="Satisfacción (Sí / valoraciones)" />
            </div>

            <div className="stats-grid">
              <ChartCard
                title="Conversaciones por etiqueta"
                subtitle="Top 8 categorías asignadas por la IA; el resto se agrupa en “Otras”"
                table={{
                  labelHeader: 'Etiqueta',
                  valueHeader: 'Conversaciones',
                  rows: stats.categories.map(c => ({ label: c.name, value: c.count }))
                }}
              >
                <ResponsiveContainer width="100%" height={Math.max(220, stats.categories.length * 34)}>
                  <BarChart
                    data={stats.categories}
                    layout="vertical"
                    margin={{ top: 4, right: 32, bottom: 4, left: 4 }}
                    barCategoryGap={10}
                  >
                    <CartesianGrid strokeDasharray="0" horizontal={false} stroke={GRID} />
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={170}
                      tick={{ fontSize: 11, fill: INK }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip cursor={{ fill: 'rgba(13,43,29,0.05)' }} content={<ChartTooltip />} />
                    <Bar dataKey="count" fill={GREEN} radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
                      <LabelList dataKey="count" position="right" formatter={fmt} style={{ fill: MUTED, fontSize: 11, fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Valoración del asistente"
                subtitle='Clics en "¿Te he resuelto las dudas?"'
                table={{
                  labelHeader: 'Respuesta',
                  valueHeader: 'Clics',
                  rows: [{ label: FEEDBACK_YES, value: stats.feedback.yes }, { label: FEEDBACK_NO, value: stats.feedback.no }]
                }}
              >
                {totalFeedback === 0 ? (
                  <div className="stats-empty">Todavía no hay valoraciones registradas.</div>
                ) : (
                  <div className="feedback-panel">
                    <div className="feedback-legend">
                      <span className="feedback-legend-item"><i style={{ background: GREEN }} /> Sí, gracias ({fmt(stats.feedback.yes)})</span>
                      <span className="feedback-legend-item"><i style={{ background: RED }} /> No, necesito más ayuda ({fmt(stats.feedback.no)})</span>
                    </div>
                    <div className="ratio-bar">
                      {stats.feedback.yes > 0 && (
                        <div
                          className="ratio-seg ratio-yes"
                          style={{ width: `${(stats.feedback.yes / totalFeedback) * 100}%` }}
                          title={`Sí, gracias: ${stats.feedback.yes}`}
                        />
                      )}
                      {stats.feedback.no > 0 && (
                        <div
                          className="ratio-seg ratio-no"
                          style={{ width: `${(stats.feedback.no / totalFeedback) * 100}%` }}
                          title={`No, necesito más ayuda: ${stats.feedback.no}`}
                        />
                      )}
                    </div>
                    <div className="feedback-total">{fmt(totalFeedback)} valoraciones en total</div>
                  </div>
                )}
              </ChartCard>

              <ChartCard
                title="Uso por día de la semana"
                subtitle="Mensajes de usuarios, hora de Madrid"
                table={{ labelHeader: 'Día', valueHeader: 'Mensajes', rows: stats.byWeekday.map(d => ({ label: d.label, value: d.count })) }}
              >
                <TrendChart data={stats.byWeekday} xKey="short" />
              </ChartCard>

              <ChartCard
                title="Uso por hora del día"
                subtitle="Mensajes de usuarios, hora de Madrid"
                table={{ labelHeader: 'Hora', valueHeader: 'Mensajes', rows: stats.byHour.map(h => ({ label: h.label, value: h.count })) }}
              >
                <TrendChart data={stats.byHour} xKey="label" />
              </ChartCard>

              <ChartCard
                title="Uso por mes"
                subtitle="Mensajes de usuarios, agregados por mes del año"
                table={{ labelHeader: 'Mes', valueHeader: 'Mensajes', rows: stats.byMonth.map(m => ({ label: m.label, value: m.count })) }}
              >
                <TrendChart data={stats.byMonth} xKey="short" />
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
