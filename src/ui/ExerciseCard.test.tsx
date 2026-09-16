// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Slot } from '../program/types'
import { DAYS } from '../program/days'
import { getExercise } from '../program/exercises'
import type { SessionEntry } from '../store/types'
import { ExerciseCard } from './ExerciseCard'

afterEach(cleanup)

const slotOf = (trackId: string): Slot => {
  for (const day of Object.values(DAYS)) {
    const found = day.slots.find((s) => s.trackId === trackId)
    if (found) return found
  }
  throw new Error(`找不到 ${trackId}`)
}

/**
 * 把卡片單獨掛起來。
 *
 * 真正的畫面會把 onChange 寫回 store 再傳下來，所以這裡也要接成受控的，
 * 否則連續改兩個欄位時第二次會蓋掉第一次。
 */
function renderCard(trackId: string, overrides: Partial<SessionEntry> = {}) {
  const slot = slotOf(trackId)
  const initial: SessionEntry = {
    trackId: slot.trackId,
    exerciseId: slot.exerciseId,
    sets: [],
    ...overrides,
  }
  const latest = { entry: initial }

  function Harness() {
    const [entry, setEntry] = useState(initial)
    latest.entry = entry
    return (
      <ExerciseCard
        slot={slot}
        exercise={getExercise(slot.exerciseId)}
        suggestion={{ action: 'start', message: '第一次做這個動作。' }}
        lastEntry={undefined}
        entry={entry}
        cautious={false}
        active
        emptyBarKg={20}
        onChange={setEntry}
        onSetLogged={vi.fn()}
      />
    )
  }

  render(<Harness />)
  return { slot, latest }
}

describe('暖身階梯', () => {
  it('槓鈴動作從設定的空槓重量開始', () => {
    const { slot } = renderCard('benchTopSet')
    fireEvent.change(screen.getByLabelText(`${slot.label} 本組重量`), { target: { value: '72.5' } })

    expect(screen.getByText(/空槓 20 kg × 10/)).toBeTruthy()
    expect(screen.getByText(/37.5 kg × 5/)).toBeTruthy()
  })

  /**
   * 掛片式機器空機多重沒人知道，而且空機太輕，
   * 所以不給「空機」那一階，直接從掛一半的片開始。
   */
  it('機械動作有階梯，但沒有空槓那一階', () => {
    renderCard('machineInclinePress')
    const exercise = getExercise('machineInclinePress')
    fireEvent.change(screen.getByLabelText(`${exercise.name} 本組重量`), { target: { value: '60' } })

    expect(screen.getByText(/30 kg × 5/)).toBeTruthy()
    expect(screen.queryByText(/空槓/)).toBeNull()
  })

  it('講明暖身不用填進下面', () => {
    const { slot } = renderCard('benchTopSet')
    fireEvent.change(screen.getByLabelText(`${slot.label} 本組重量`), { target: { value: '72.5' } })

    expect(screen.getByText(/不用填/)).toBeTruthy()
  })

  /** 降重工作組接在主力重組後面做，人早就熱開了。 */
  it('降重工作組不給階梯也不給熱身格', () => {
    const { slot } = renderCard('benchBackoff')
    fireEvent.change(screen.getByLabelText(`${slot.label} 本組重量`), { target: { value: '65' } })

    expect(screen.queryByText(/暖身/)).toBeNull()
    expect(screen.queryByLabelText(`${slot.label} 熱身第 1 組重量`)).toBeNull()
  })

  it('啞鈴動作不給階梯', () => {
    const exercise = getExercise('inclineDbPress')
    renderCard('inclineDbPress')
    fireEvent.change(screen.getByLabelText(`${exercise.name} 本組重量`), { target: { value: '30' } })

    expect(screen.queryByText(/暖身/)).toBeNull()
  })
})

describe('熱身組', () => {
  it('填進去的熱身會存成 warmupSets，不進正式組', () => {
    const exercise = getExercise('machineInclinePress')
    const { latest } = renderCard('machineInclinePress')

    fireEvent.change(screen.getByLabelText(`${exercise.name} 熱身第 1 組重量`), {
      target: { value: '30' },
    })
    fireEvent.change(screen.getByLabelText(`${exercise.name} 熱身第 1 組次數`), {
      target: { value: '10' },
    })

    expect(latest.entry.warmupSets?.[0]).toMatchObject({ weight: 30, reps: 10 })
    expect(latest.entry.sets).toEqual([])
  })
})
