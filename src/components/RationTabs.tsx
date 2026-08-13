import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RationTab } from '../types/appData'
import { Icon } from './Icon'

type RationTabsProps = {
  tabs: RationTab[]
  activeTabId: string
  onSelect: (tabId: string) => void
  onCreate: () => void
  onRename: (tabId: string, name: string) => void
  onDelete: (tabId: string) => void
}

type TabChipProps = {
  tab: RationTab
  active: boolean
  compact?: boolean
  canDelete: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onDelete: () => void
}

function TabChip({
  tab,
  active,
  compact = false,
  canDelete,
  onSelect,
  onRename,
  onDelete,
}: TabChipProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(tab.name)

  useEffect(() => setDraft(tab.name), [tab.name])

  const finishEditing = () => {
    const nextName = draft.trim()
    if (nextName) onRename(nextName)
    else setDraft(tab.name)
    setEditing(false)
  }

  return (
    <div className={`ration-tab${active ? ' ration-tab--active' : ''}${compact ? ' ration-tab--compact' : ''}`}>
      {editing ? (
        <input
          className="ration-tab__input"
          value={draft}
          maxLength={60}
          autoFocus
          aria-label={`Новое название вкладки «${tab.name}»`}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={finishEditing}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') {
              setDraft(tab.name)
              setEditing(false)
            }
          }}
        />
      ) : (
        <button
          className="ration-tab__select"
          type="button"
          role={compact ? undefined : 'tab'}
          aria-selected={compact ? undefined : active}
          title={tab.name}
          onClick={onSelect}
          onDoubleClick={() => setEditing(true)}
        >
          <span>{tab.name}</span>
          <small>{tab.rationEntries.length}</small>
        </button>
      )}
      <button
        className="ration-tab__action"
        type="button"
        aria-label={`Переименовать вкладку «${tab.name}»`}
        title="Переименовать"
        onClick={() => setEditing(true)}
      >
        <Icon name="edit" size={13} />
      </button>
      <button
        className="ration-tab__action ration-tab__action--delete"
        type="button"
        disabled={!canDelete}
        aria-label={`Удалить вкладку «${tab.name}»`}
        title={canDelete ? 'Удалить вкладку' : 'Последнюю вкладку удалить нельзя'}
        onClick={onDelete}
      >
        <Icon name="close" size={13} />
      </button>
    </div>
  )
}

export function RationTabs({
  tabs,
  activeTabId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: RationTabsProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const overflowRef = useRef<HTMLDivElement>(null)
  const [visibleLimit, setVisibleLimit] = useState(tabs.length)
  const [overflowOpen, setOverflowOpen] = useState(false)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const updateVisibleLimit = () => {
      const width = root.clientWidth
      const tabWithGap = 166
      const addButtonWithGap = 48
      const overflowButtonWithGap = 48
      const withoutOverflow = Math.max(1, Math.floor((width - addButtonWithGap) / tabWithGap))
      const nextLimit = tabs.length <= withoutOverflow
        ? tabs.length
        : Math.max(1, Math.floor((width - addButtonWithGap - overflowButtonWithGap) / tabWithGap))
      setVisibleLimit(nextLimit)
    }

    updateVisibleLimit()
    const resizeObserver = new ResizeObserver(updateVisibleLimit)
    resizeObserver.observe(root)
    return () => resizeObserver.disconnect()
  }, [tabs.length])

  useEffect(() => {
    if (!overflowOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!overflowRef.current?.contains(event.target as Node)) setOverflowOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOverflowOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [overflowOpen])

  const { visibleTabs, hiddenTabs } = useMemo(() => {
    if (tabs.length <= visibleLimit) return { visibleTabs: tabs, hiddenTabs: [] }

    const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === activeTabId))
    const startIndex = activeIndex >= visibleLimit ? activeIndex - visibleLimit + 1 : 0
    const nextVisibleTabs = tabs.slice(startIndex, startIndex + visibleLimit)
    const visibleIds = new Set(nextVisibleTabs.map((tab) => tab.id))
    return {
      visibleTabs: nextVisibleTabs,
      hiddenTabs: tabs.filter((tab) => !visibleIds.has(tab.id)),
    }
  }, [activeTabId, tabs, visibleLimit])

  useEffect(() => {
    if (hiddenTabs.length === 0) setOverflowOpen(false)
  }, [hiddenTabs.length])

  return (
    <div className="ration-tabs" ref={rootRef}>
      <div className="ration-tabs__list" role="tablist" aria-label="Наборы продуктов">
        {visibleTabs.map((tab) => (
          <TabChip
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            canDelete={tabs.length > 1}
            onSelect={() => onSelect(tab.id)}
            onRename={(name) => onRename(tab.id, name)}
            onDelete={() => onDelete(tab.id)}
          />
        ))}
      </div>

      {hiddenTabs.length > 0 && (
        <div className="ration-tabs__overflow" ref={overflowRef}>
          <button
            className={`ration-tabs__control${overflowOpen ? ' ration-tabs__control--active' : ''}`}
            type="button"
            aria-label="Показать скрытые вкладки"
            aria-expanded={overflowOpen}
            title="Все вкладки"
            onClick={() => setOverflowOpen((current) => !current)}
          >
            <Icon name="chevron-down" size={17} />
            <span>{hiddenTabs.length}</span>
          </button>
          {overflowOpen && (
            <div className="ration-tabs__menu" role="menu">
              {hiddenTabs.map((tab) => (
                <TabChip
                  key={tab.id}
                  tab={tab}
                  active={tab.id === activeTabId}
                  compact
                  canDelete={tabs.length > 1}
                  onSelect={() => {
                    onSelect(tab.id)
                    setOverflowOpen(false)
                  }}
                  onRename={(name) => onRename(tab.id, name)}
                  onDelete={() => onDelete(tab.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <button
        className="ration-tabs__control ration-tabs__add"
        type="button"
        aria-label="Создать новую вкладку"
        title="Новая вкладка"
        onClick={onCreate}
      >
        <Icon name="plus" size={18} />
      </button>
    </div>
  )
}
