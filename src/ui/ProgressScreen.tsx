import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { MUSCLE_LABEL, MUSCLE_ORDER } from '../program/types'
import { plannedWeeklyVolume } from '../engine/volume'
import { formatShortDate, weekKey } from '../engine/dates'
import { formatWeight } from '../engine/units'
import { benchTopSetTrend, weeklyVolumeTrend } from '../store/selectors'
import { useAppData } from './store'

const AXIS = { stroke: '#98a2b3', fontSize: 12 }
const GRID = '#2b313b'

function ChartFrame({ children }: { children: React.ReactElement }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

const tooltipStyle = {
  background: '#1f242d',
  border: '1px solid #2b313b',
  borderRadius: 10,
  color: '#f2f4f7',
  fontSize: 13,
}

export function ProgressScreen() {
  const { sessions, bodyWeight, state } = useAppData()

  const bench = useMemo(
    () =>
      benchTopSetTrend(sessions).map((point) => ({
        label: formatShortDate(point.date),
        重量: point.weight,
        推估單次最大重量: point.e1rm,
      })),
    [sessions],
  )

  const weightSeries = useMemo(
    () =>
      bodyWeight.map((record) => ({
        label: formatShortDate(record.date),
        體重: record.weight,
      })),
    [bodyWeight],
  )

  const volumeTrend = useMemo(() => weeklyVolumeTrend(sessions), [sessions])
  const volumeSeries = useMemo(
    () =>
      volumeTrend.map((point) => ({
        label: formatShortDate(point.week),
        胸: point.volume.chest,
        背: point.volume.back,
      })),
    [volumeTrend],
  )

  const thisWeek = volumeTrend.find((point) => point.week === weekKey())
  const target = useMemo(() => plannedWeeklyVolume(state.mode), [state.mode])

  // 完全沒資料時，四張「還畫不出趨勢」的卡片只是四次一樣的話。
  if (sessions.length === 0 && bodyWeight.length === 0) {
    return (
      <div className="empty">
        <div style={{ marginBottom: 8 }}>還沒有東西可以看。</div>
        <div className="small">
          練完兩次之後，這裡會有臥推趨勢、體重趨勢，以及每週胸背的工作組數。
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="section-title">臥推主力重組</div>
      <div className="card">
        {bench.length < 2 ? (
          <div className="empty" style={{ padding: '20px 0' }}>
            至少要有兩次主力重組紀錄才畫得出趨勢。
          </div>
        ) : (
          <ChartFrame>
            <LineChart data={bench} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="重量" stroke="#22c55e" strokeWidth={2} dot />
              <Line
                type="monotone"
                dataKey="推估單次最大重量"
                stroke="#60a5fa"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
              />
            </LineChart>
          </ChartFrame>
        )}
        <div className="small muted" style={{ marginTop: 8 }}>
          推估單次最大重量只用來看趨勢，不需要真的去測。
        </div>
      </div>

      <div className="section-title">體重</div>
      <div className="card">
        {weightSeries.length < 2 ? (
          <div className="empty" style={{ padding: '20px 0' }}>
            至少要有兩筆體重紀錄才畫得出趨勢。
          </div>
        ) : (
          <ChartFrame>
            <LineChart data={weightSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="體重" stroke="#22c55e" strokeWidth={2} dot />
            </LineChart>
          </ChartFrame>
        )}
      </div>

      <div className="section-title">每週胸與背的工作組</div>
      <div className="card">
        {volumeSeries.length < 2 ? (
          <div className="empty" style={{ padding: '20px 0' }}>
            至少要有兩週紀錄才畫得出趨勢。
          </div>
        ) : (
          <ChartFrame>
            <LineChart data={volumeSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="胸" stroke="#22c55e" strokeWidth={2} dot />
              <Line type="monotone" dataKey="背" stroke="#60a5fa" strokeWidth={2} dot />
            </LineChart>
          </ChartFrame>
        )}
      </div>

      <div className="section-title">本週訓練量</div>
      <div className="card">
        {!thisWeek ? (
          <div className="empty" style={{ padding: '20px 0' }}>
            本週還沒有訓練紀錄。
          </div>
        ) : (
          MUSCLE_ORDER.map((muscle) => {
            const done = thisWeek.volume[muscle]
            const planned = target[muscle]
            const ratio = planned > 0 ? Math.min(1, done / planned) : 0
            return (
              <div key={muscle} style={{ marginBottom: 12 }}>
                <div className="row row--between small">
                  <span>{MUSCLE_LABEL[muscle]}</span>
                  <span className="muted">
                    {formatWeight(done)} / {formatWeight(planned)} 組
                  </span>
                </div>
                <div className="volume-bar">
                  <div className="volume-bar__fill" style={{ width: `${ratio * 100}%` }} />
                </div>
              </div>
            )
          })
        )}
        <div className="small muted" style={{ marginTop: 4 }}>
          分母是 {state.mode} 天課表排定的組數。主要肌群記整組，次要肌群記半組。組數不是越多越好，這裡只是讓你看得到落差。
        </div>
      </div>
    </>
  )
}
