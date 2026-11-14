import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

  const cancelEditing = () => {
    setDraft(tab.name)
    setEditing(false)
  }

  return (
    <div
      className={`ration-tab${active ? ' ration-tab--active' : ''}${compact ? ' ration-tab--compact' : ''}${editing ? ' ration-tab--editing' : ''}`}
      onBlur={(event) => {
        if (editing && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
          finishEditing()
        }
      }}
    >
      {editing ? (
        <input
          className="ration-tab__input"
          value={draft}
          maxLength={60}
          autoFocus
          aria-label={`Новое название вкладки «${tab.name}»`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              finishEditing()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              cancelEditing()
            }
          }}
        />
      ) : (
        <button
          className="ration-tab__select"
          type="button"
          role={compact ? undefined : 'tab'}
          aria-selected={compact ? undefined : active}
          aria-current={compact && active ? 'true' : undefined}
          title={tab.name}
          onClick={onSelect}
          onDoubleClick={() => setEditing(true)}
        >
          <span>{tab.name}</span>
          <small>{tab.rationEntries.length}</small>
        </button>
      )}
      {editing ? (
        <>
          <button
            className="ration-tab__action ration-tab__action--delete"
            type="button"
            aria-label={`Отменить переименование вкладки «${tab.name}»`}
            title="Отменить"
            onPointerDown={(event) => event.preventDefault()}
            onClick={cancelEditing}
          >
            <Icon name="close" size={13} />
          </button>
          <button
            className="ration-tab__action"
            type="button"
            disabled={!draft.trim()}
            aria-label={`Сохранить название вкладки «${tab.name}»`}
            title="Сохранить"
            onPointerDown={(event) => event.preventDefault()}
            onClick={finishEditing}
          >
            <Icon name="check" size={13} />
          </button>
        </>
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}

type RationTabMenuProps = RationTabsProps & {
  id: string
  above: boolean
  maxHeight: number
  canDelete: boolean
}

function RationTabMenu({
  id,
  tabs,
  activeTabId,
  above,
  maxHeight,
  canDelete,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: RationTabMenuProps) {
  return (
    <div
      id={id}
      className={`ration-tabs__menu${above ? ' ration-tabs__menu--above' : ''}`}
      style={{ maxHeight }}
      role="group"
      aria-label="Выбор и управление наборами"
    >
      <ul className="ration-tabs__options" aria-label="Наборы продуктов">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <TabChip
              tab={tab}
              active={tab.id === activeTabId}
              compact
              canDelete={canDelete}
              onSelect={() => onSelect(tab.id)}
              onRename={(name) => onRename(tab.id, name)}
              onDelete={() => onDelete(tab.id)}
            />
          </li>
        ))}
      </ul>
      <button className="ration-tabs__create" type="button" onClick={onCreate}>
        <Icon name="plus" size={18} />
        Добавить набор
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
  const overflowTriggerRef = useRef<HTMLButtonElement>(null)
  const addTriggerRef = useRef<HTMLButtonElement>(null)
  const mobileRef = useRef<HTMLDivElement>(null)
  const mobileTriggerRef = useRef<HTMLButtonElement>(null)
  const mobileMenuId = useId()
  const overflowMenuId = useId()
  const [visibleLimit, setVisibleLimit] = useState(tabs.length)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuLayout, setMenuLayout] = useState({ above: false, maxHeight: 360 })
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]

  useLayoutEffect(() => {
    if (!mobileOpen && !overflowOpen) return

    const updatePosition = () => {
      const anchor = mobileOpen ? mobileRef.current : overflowRef.current
      const bounds = anchor?.getBoundingClientRect()
      if (!bounds) return
      const viewport = window.visualViewport
      const viewportTop = viewport?.offsetTop ?? 0
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight)
      const spaceBelow = viewportBottom - bounds.bottom - 12
      const spaceAbove = bounds.top - viewportTop - 12
      const above = spaceBelow < 200 && spaceAbove > spaceBelow
      const maxHeight = Math.max(80, Math.min(360, above ? spaceAbove : spaceBelow))
      setMenuLayout((current) => current.above === above && current.maxHeight === maxHeight
        ? current
        : { above, maxHeight })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition)
    window.visualViewport?.addEventListener('resize', updatePosition)
    window.visualViewport?.addEventListener('scroll', updatePosition)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
      window.visualViewport?.removeEventListener('resize', updatePosition)
      window.visualViewport?.removeEventListener('scroll', updatePosition)
    }
  }, [mobileOpen, overflowOpen])

  useEffect(() => {
    if (!mobileOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!mobileRef.current?.contains(event.target as Node)) {
        const focusedElement = document.activeElement
        if (focusedElement instanceof HTMLElement && mobileRef.current?.contains(focusedElement)) {
          focusedElement.blur()
        }
        setMobileOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setMobileOpen(false)
      mobileTriggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileOpen])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 720px)')
    const closeMenus = () => {
      setMobileOpen(false)
      setOverflowOpen(false)
    }
    mediaQuery.addEventListener('change', closeMenus)
    return () => mediaQuery.removeEventListener('change', closeMenus)
  }, [])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const updateVisibleLimit = () => {
      const width = root.clientWidth
      const tabWithGap = 166
      const controlWidth = 42
      const nextLimit = Math.max(1, Math.floor((width - controlWidth) / tabWithGap))
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
      if (!overflowRef.current?.contains(event.target as Node)) {
        const focusedElement = document.activeElement
        if (focusedElement instanceof HTMLElement && overflowRef.current?.contains(focusedElement)) {
          focusedElement.blur()
        }
        setOverflowOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOverflowOpen(false)
      overflowTriggerRef.current?.focus()
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
    if (hiddenTabs.length === 0 && overflowOpen) {
      setOverflowOpen(false)
      addTriggerRef.current?.focus()
    }
  }, [hiddenTabs.length, overflowOpen])

  return (
    <div className="ration-tabs" ref={rootRef}>
      <div
        className="ration-tabs__mobile"
        ref={mobileRef}
        onBlur={(event) => {
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) {
            setMobileOpen(false)
          }
        }}
      >
        <button
          ref={mobileTriggerRef}
          className={`ration-tabs__mobile-trigger${mobileOpen ? ' ration-tabs__mobile-trigger--open' : ''}`}
          type="button"
          aria-expanded={mobileOpen}
          aria-controls={mobileOpen ? mobileMenuId : undefined}
          aria-label={`Выбрать набор. Текущий набор: ${activeTab?.name ?? 'не выбран'}`}
          title={activeTab?.name}
          onClick={() => setMobileOpen((current) => !current)}
        >
          <span>{activeTab?.name ?? 'Выберите набор'}</span>
          <Icon name="chevron-down" size={18} />
        </button>
        {mobileOpen && (
          <RationTabMenu
            id={mobileMenuId}
            tabs={tabs}
            canDelete={tabs.length > 1}
            activeTabId={activeTab?.id ?? ''}
            above={menuLayout.above}
            maxHeight={menuLayout.maxHeight}
            onSelect={(tabId) => {
              onSelect(tabId)
              setMobileOpen(false)
              mobileTriggerRef.current?.focus()
            }}
            onCreate={onCreate}
            onRename={onRename}
            onDelete={(tabId) => {
              onDelete(tabId)
              mobileTriggerRef.current?.focus()
            }}
          />
        )}
      </div>
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
        <div
          className="ration-tabs__overflow"
          ref={overflowRef}
          onBlur={(event) => {
            if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) {
              setOverflowOpen(false)
            }
          }}
        >
          <button
            ref={overflowTriggerRef}
            className={`ration-tabs__control${overflowOpen ? ' ration-tabs__control--active' : ''}`}
            type="button"
            aria-label="Скрытые наборы"
            aria-expanded={overflowOpen}
            aria-controls={overflowOpen ? overflowMenuId : undefined}
            title="Скрытые наборы"
            onClick={() => setOverflowOpen((current) => !current)}
          >
            <Icon name="chevron-down" size={17} />
          </button>
          {overflowOpen && (
            <RationTabMenu
              id={overflowMenuId}
              tabs={hiddenTabs}
              canDelete={tabs.length > 1}
              activeTabId={activeTab?.id ?? ''}
              above={menuLayout.above}
              maxHeight={menuLayout.maxHeight}
              onSelect={(tabId) => {
                onSelect(tabId)
                setOverflowOpen(false)
                overflowTriggerRef.current?.focus()
              }}
              onCreate={onCreate}
              onRename={onRename}
              onDelete={(tabId) => {
                onDelete(tabId)
                overflowTriggerRef.current?.focus()
              }}
            />
          )}
        </div>
      )}

      {hiddenTabs.length === 0 && (
        <button
          ref={addTriggerRef}
          className="ration-tabs__control ration-tabs__add"
          type="button"
          aria-label="Создать новую вкладку"
          title="Новая вкладка"
          onClick={onCreate}
        >
          <Icon name="plus" size={18} />
        </button>
      )}
    </div>
  )
}
