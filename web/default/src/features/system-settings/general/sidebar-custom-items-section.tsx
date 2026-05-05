import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  getLucideIcon,
  listLucideIconNames,
} from '@/lib/lucide-icon'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

interface SidebarCustomItem {
  id: string
  title: string
  url: string
  icon?: string
  group?: string
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function safeParse(raw: string): SidebarCustomItem[] {
  try {
    const parsed = JSON.parse(raw || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (it) =>
          it &&
          typeof it === 'object' &&
          typeof it.title === 'string' &&
          typeof it.url === 'string'
      )
      .map((it) => ({
        id: typeof it.id === 'string' && it.id ? it.id : genId(),
        title: it.title,
        url: it.url,
        icon: typeof it.icon === 'string' ? it.icon : undefined,
        group: typeof it.group === 'string' ? it.group : undefined,
      }))
  } catch {
    return []
  }
}

function IconPicker({
  value,
  onChange,
}: {
  value?: string
  onChange: (next?: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const allNames = useMemo(() => listLucideIconNames(), [])
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? allNames.filter((n) => n.toLowerCase().includes(q)) : allNames
    // 限制渲染数量，避免一次性渲染 1500 个组件造成卡顿
    return list.slice(0, 240)
  }, [allNames, query])

  const Selected = getLucideIcon(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          className='justify-start gap-2'
          aria-label={t('Pick icon')}
        >
          <Selected className='size-4' />
          <span className='truncate text-xs'>{value || t('No icon')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-80 p-3' align='start'>
        <Input
          placeholder={t('Search icons')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className='mb-2'
        />
        <ScrollArea className='h-64'>
          <div className='grid grid-cols-8 gap-1'>
            <Button
              type='button'
              variant={!value ? 'secondary' : 'ghost'}
              size='icon'
              className='size-8'
              onClick={() => {
                onChange(undefined)
                setOpen(false)
              }}
              title={t('No icon')}
            >
              <span className='text-muted-foreground text-xs'>—</span>
            </Button>
            {matches.map((name) => {
              const Icon = getLucideIcon(name)
              return (
                <Button
                  key={name}
                  type='button'
                  variant={value === name ? 'secondary' : 'ghost'}
                  size='icon'
                  className='size-8'
                  onClick={() => {
                    onChange(name)
                    setOpen(false)
                  }}
                  title={name}
                >
                  <Icon className='size-4' />
                </Button>
              )
            })}
          </div>
          {query && matches.length === 0 && (
            <div className='text-muted-foreground py-6 text-center text-xs'>
              {t('No matching icon')}
            </div>
          )}
        </ScrollArea>
        <div className='text-muted-foreground mt-2 text-[10px]'>
          {t('Showing up to 240 results — refine search to find more.')}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function SidebarCustomItemsSection({
  defaultValue,
}: {
  defaultValue: string
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [items, setItems] = useState<SidebarCustomItem[]>(() =>
    safeParse(defaultValue)
  )

  // 当上游 options 重新加载时同步本地状态
  useEffect(() => {
    setItems(safeParse(defaultValue))
  }, [defaultValue])

  const handleChange = (
    id: string,
    patch: Partial<SidebarCustomItem>
  ): void => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    )
  }

  const handleRemove = (id: string): void => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const handleAdd = (): void => {
    setItems((prev) => [
      ...prev,
      { id: genId(), title: '', url: '', icon: undefined, group: undefined },
    ])
  }

  const handleSave = async (): Promise<void> => {
    const cleaned = items
      .map((it) => ({
        ...it,
        title: it.title.trim(),
        url: it.url.trim(),
        icon: it.icon?.trim() || undefined,
        group: it.group?.trim() || undefined,
      }))
      .filter((it) => it.title && it.url)
    try {
      await updateOption.mutateAsync({
        key: 'SidebarCustomItems',
        value: JSON.stringify(cleaned),
      })
      toast.success(t('Sidebar custom items saved'))
      setItems(cleaned)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('Failed to save sidebar items')
      )
    }
  }

  return (
    <SettingsSection
      title={t('Sidebar Custom Items')}
      description={t(
        'Custom navigation entries appended to the sidebar. URL accepts external (https://...) or internal (/path) links.'
      )}
    >
      <div className='space-y-3'>
        {items.length === 0 && (
          <div className='text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm'>
            {t('No custom sidebar items configured.')}
          </div>
        )}

        {items.map((item) => (
          <div
            key={item.id}
            className='grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_1fr_8rem_8rem_auto] md:items-end'
          >
            <div className='space-y-1'>
              <Label className='text-xs'>{t('Title')}</Label>
              <Input
                value={item.title}
                onChange={(e) => handleChange(item.id, { title: e.target.value })}
                placeholder={t('e.g. Documentation')}
              />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>{t('URL')}</Label>
              <Input
                value={item.url}
                onChange={(e) => handleChange(item.id, { url: e.target.value })}
                placeholder='https://example.com/docs'
              />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>{t('Group')}</Label>
              <Input
                value={item.group ?? ''}
                onChange={(e) =>
                  handleChange(item.id, { group: e.target.value || undefined })
                }
                placeholder={t('Custom')}
              />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>{t('Icon')}</Label>
              <IconPicker
                value={item.icon}
                onChange={(next) => handleChange(item.id, { icon: next })}
              />
            </div>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              onClick={() => handleRemove(item.id)}
              aria-label={t('Remove')}
            >
              <Trash2 className='size-4' />
            </Button>
          </div>
        ))}

        <div className='flex gap-2'>
          <Button type='button' variant='outline' onClick={handleAdd}>
            <Plus className='mr-1 size-4' />
            {t('Add item')}
          </Button>
          <Button
            type='button'
            onClick={handleSave}
            disabled={updateOption.isPending}
          >
            {updateOption.isPending ? t('Saving...') : t('Save Changes')}
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}
