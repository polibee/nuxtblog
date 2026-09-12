<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  BracesIcon,
  CodeIcon,
  Heading2Icon,
  Heading3Icon,
  HighlighterIcon,
  ImagePlusIcon,
  ItalicIcon,
  Link2Icon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MinusIcon,
  PaletteIcon,
  SparklesIcon,
  Loader2Icon,
  QuoteIcon,
  Redo2Icon,
  SquareSlashIcon,
  StrikethroughIcon,
  SubscriptIcon,
  SuperscriptIcon,
  TableIcon,
  UnderlineIcon,
  Undo2Icon
} from 'lucide-vue-next'
import { cn } from '~/admin/utils/cn'

import TurndownService from 'turndown'
import { marked } from 'marked'
import { useForm } from 'vee-validate'

const props = withDefaults(defineProps<{
  modelValue?: string
  disabled?: boolean
  placeholder?: string
}>(), { modelValue: '', placeholder: 'Write something…' })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { t, locale } = useI18n()

/* three modes: rich (tiptap) / markdown source / preview */
type EditorMode = 'rich' | 'markdown' | 'preview'
const mode = ref<EditorMode>('rich')
const markdownSource = ref('')
const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })

function enterMarkdown(): void {
  markdownSource.value = turndown.turndown(editor.value?.isEmpty ? '' : editor.value!.getHTML())
  mode.value = 'markdown'
}

function applyMarkdown(): void {
  const html = marked.parse(markdownSource.value, { async: false }) as string
  editor.value?.commands.setContent(html)
  emit('update:modelValue', editor.value!.isEmpty ? '' : editor.value!.getHTML())
  mode.value = 'rich'
}

const previewHtml = computed(() => marked.parse(markdownSource.value, { async: false }) as string)

function switchMode(next: EditorMode): void {
  if (next === mode.value) return
  if (mode.value === 'markdown' && next !== 'markdown') {
    applyMarkdown()
  } else if (next === 'markdown') {
    enterMarkdown()
  } else {
    mode.value = next
  }
}

/* paid content: wrap selection or insert markers, set post pricing fields */
const paidOpen = ref(false)
const paidPriceText = ref('')
const paidPrice = computed(() => {
  const n = Number(paidPriceText.value)
  return Number.isFinite(n) && n > 0 ? n : null
})
const paidCurrency = ref<'USD' | 'CNY' | 'EUR'>('USD')
const { setFieldValue: setFormValue } = useForm()

function openPaidDialog(): void {
  paidOpen.value = true
}

function applyPaid(): void {
  const e = editor.value
  if (!e) return
  const { from, to, empty } = e.state.selection
  if (empty) {
    e.chain().focus().insertContent('[paid] 付费内容… [/paid]').run()
  } else {
    e.chain().focus().insertContentAt(from, '[paid]').insertContentAt(to + 6, '[/paid]').run()
  }
  setFormValue('accessType', 'paid')
  if (paidPrice.value !== null && paidPrice.value > 0) setFormValue('paidPriceMinor', paidPrice.value)
  setFormValue('paidCurrency', paidCurrency.value)
  paidOpen.value = false
}

const editor = useEditor({
  content: props.modelValue || '',
  editable: !props.disabled,
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: { openOnClick: false }
    }),
    Image.configure({ inline: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight,
    TextStyle,
    Color,
    Subscript,
    Superscript,
    CharacterCount,
    Placeholder.configure({ placeholder: props.placeholder }),
    Table.configure({ resizable: false }),
    TableRow,
    TableCell,
    TableHeader
  ],
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.isEmpty ? '' : editor.getHTML())
  }
})

const charCount = computed(() => editor.value?.storage.characterCount.characters() ?? 0)

watch(() => props.modelValue, (value) => {
  if (!editor.value) return
  if ((editor.value.isEmpty ? '' : editor.value.getHTML()) === value) return
  editor.value.commands.setContent(value || '')
})

watch(() => props.disabled, (disabled) => {
  editor.value?.setEditable(!disabled)
})

/* ---------------- modern prompt dialog (link / image / color) ---------------- */

const promptOpen = ref(false)
const promptKind = ref<'link' | 'image' | 'color'>('link')
const promptUrl = ref('')
const promptAlt = ref('')
const promptColorHex = ref('#d64545')

function openLink(): void {
  const e = editor.value
  if (!e) return
  if (e.isActive('link')) {
    e.chain().focus().unsetLink().run()
    return
  }
  promptKind.value = 'link'
  promptUrl.value = String(e.getAttributes('link').href ?? '')
  promptOpen.value = true
}

function openImage(): void {
  promptKind.value = 'image'
  promptUrl.value = ''
  promptAlt.value = ''
  promptOpen.value = true
}

function openColor(): void {
  promptKind.value = 'color'
  promptColorHex.value = '#d64545'
  promptOpen.value = true
}

const promptValid = computed(() =>
  promptKind.value === 'color' || /^https?:\/\/.+/.test(promptUrl.value.trim())
)

function applyPrompt(): void {
  const e = editor.value
  if (!e || !promptValid.value) return
  if (promptKind.value === 'link') {
    const href = promptUrl.value.trim()
    const { from, to, empty } = e.state.selection
    if (empty && !e.isActive('link')) {
      // collapsed caret with no link: insert the URL as linked text
      e.chain().focus().insertContent({
        type: 'text',
        text: href,
        marks: [{ type: 'link', attrs: { href } }]
      }).run()
    } else {
      e.chain().focus().setTextSelection({ from, to }).extendMarkRange('link').setLink({ href }).run()
    }
  } else if (promptKind.value === 'image') {
    e.chain().focus().setImage({ src: promptUrl.value.trim(), alt: promptAlt.value || undefined }).run()
  } else {
    e.chain().focus().setColor(promptColorHex.value).run()
  }
  promptOpen.value = false
}

const promptTitle = computed(() =>
  promptKind.value === 'link' ? t('dialog.insertLink') : promptKind.value === 'image' ? t('dialog.insertImage') : t('dialog.textColor')
)

function insertTable(): void {
  editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

interface ToolButton {
  label: string
  icon: typeof BoldIcon
  active?: boolean
  disabled?: boolean
  run: () => void
}

interface ToolGroup {
  buttons: ToolButton[]
}

const groups = computed<ToolGroup[]>(() => {
  const e = editor.value
  if (!e) return []
  const chain = () => e.chain().focus()
  return [
    { buttons: [
      { label: t('editor.undo'), icon: Undo2Icon, disabled: !e.can().undo(), run: () => chain().undo().run() },
      { label: t('editor.redo'), icon: Redo2Icon, disabled: !e.can().redo(), run: () => chain().redo().run() }
    ] },
    { buttons: [
      { label: t('editor.bold'), icon: BoldIcon, active: e.isActive('bold'), run: () => chain().toggleBold().run() },
      { label: t('editor.italic'), icon: ItalicIcon, active: e.isActive('italic'), run: () => chain().toggleItalic().run() },
      { label: t('editor.underline'), icon: UnderlineIcon, active: e.isActive('underline'), run: () => chain().toggleUnderline().run() },
      { label: t('editor.strike'), icon: StrikethroughIcon, active: e.isActive('strike'), run: () => chain().toggleStrike().run() },
      { label: t('editor.code'), icon: CodeIcon, active: e.isActive('code'), run: () => chain().toggleCode().run() },
      { label: t('editor.superscript'), icon: SuperscriptIcon, active: e.isActive('superscript'), run: () => chain().toggleSuperscript().run() },
      { label: t('editor.subscript'), icon: SubscriptIcon, active: e.isActive('subscript'), run: () => chain().toggleSubscript().run() }
    ] },
    { buttons: [
      { label: t('editor.h2'), icon: Heading2Icon, active: e.isActive('heading', { level: 2 }), run: () => chain().toggleHeading({ level: 2 }).run() },
      { label: t('editor.h3'), icon: Heading3Icon, active: e.isActive('heading', { level: 3 }), run: () => chain().toggleHeading({ level: 3 }).run() }
    ] },
    { buttons: [
      { label: t('editor.bulletList'), icon: ListIcon, active: e.isActive('bulletList'), run: () => chain().toggleBulletList().run() },
      { label: t('editor.orderedList'), icon: ListOrderedIcon, active: e.isActive('orderedList'), run: () => chain().toggleOrderedList().run() },
      { label: t('editor.taskList'), icon: ListTodoIcon, active: e.isActive('taskList'), run: () => chain().toggleTaskList().run() },
      { label: t('editor.quote'), icon: QuoteIcon, active: e.isActive('blockquote'), run: () => chain().toggleBlockquote().run() },
      { label: t('editor.codeBlock'), icon: BracesIcon, active: e.isActive('codeBlock'), run: () => chain().toggleCodeBlock().run() }
    ] },
    { buttons: [
      { label: t('editor.alignLeft'), icon: AlignLeftIcon, active: e.isActive({ textAlign: 'left' }), run: () => chain().setTextAlign('left').run() },
      { label: t('editor.alignCenter'), icon: AlignCenterIcon, active: e.isActive({ textAlign: 'center' }), run: () => chain().setTextAlign('center').run() },
      { label: t('editor.alignRight'), icon: AlignRightIcon, active: e.isActive({ textAlign: 'right' }), run: () => chain().setTextAlign('right').run() },
      { label: t('editor.justify'), icon: AlignJustifyIcon, active: e.isActive({ textAlign: 'justify' }), run: () => chain().setTextAlign('justify').run() }
    ] },
    { buttons: [
      { label: t('editor.highlight'), icon: HighlighterIcon, active: e.isActive('highlight'), run: () => chain().toggleHighlight().run() },
      { label: t('editor.color'), icon: PaletteIcon, run: openColor }
    ] },
    { buttons: [
      { label: t('editor.link'), icon: Link2Icon, active: e.isActive('link'), run: openLink },
      { label: t('editor.image'), icon: ImagePlusIcon, run: openImage },
      { label: t('editor.divider'), icon: MinusIcon, run: () => chain().setHorizontalRule().run() }
    ] },
    { buttons: [
      { label: t('editor.table'), icon: TableIcon, active: e.isActive('table'), run: insertTable },
      { label: t('editor.addRow'), icon: TableIcon, disabled: !e.isActive('table'), run: () => chain().addRowAfter().run() },
      { label: t('editor.addColumn'), icon: TableIcon, disabled: !e.isActive('table'), run: () => chain().addColumnAfter().run() },
      { label: t('editor.deleteRow'), icon: SquareSlashIcon, disabled: !e.isActive('table'), run: () => chain().deleteRow().run() },
      { label: t('editor.deleteColumn'), icon: SquareSlashIcon, disabled: !e.isActive('table'), run: () => chain().deleteColumn().run() },
      { label: t('editor.deleteTable'), icon: SquareSlashIcon, disabled: !e.isActive('table'), run: () => chain().deleteTable().run() }
    ] }
  ]
})

/* ---------- Editor AI (P28 / ADR 0005): selection AI with explicit
   preview; the AI never modifies content without user action ---------- */

const AI_TONES = ['professional', 'casual', 'technical', 'concise', 'friendly', 'academic']

const aiOpen = ref(false)
const aiFeature = ref('improve')
const aiTone = ref('professional')
const aiInstruction = ref('')
const aiRunning = ref(false)
const aiError = ref('')
const aiResult = ref('')
const aiRange = ref<{ from: number, to: number, text: string } | null>(null)

function openAiPanel(): void {
  const e = editor.value
  if (!e) return
  const { from, to } = e.state.selection
  const text = e.state.doc.textBetween(from, to, '\n').trim()
  aiRange.value = text ? { from, to, text } : null
  aiOpen.value = !aiOpen.value
  aiError.value = ''
  if (!text && aiOpen.value) {
    aiError.value = t('editor.ai.needSelection')
  }
}

async function runAi(): Promise<void> {
  const e = editor.value
  if (!e) return
  const { from, to } = e.state.selection
  const text = e.state.doc.textBetween(from, to, '\n').trim()
  if (!text) {
    aiError.value = t('editor.ai.needSelection')
    return
  }
  aiRange.value = { from, to, text }
  aiRunning.value = true
  aiError.value = ''
  aiResult.value = ''
  try {
    const res = await $fetch<{ text: string }>('/api/admin/ai/editor', {
      method: 'POST',
      body: {
        feature: aiFeature.value,
        selectedText: text,
        instruction: aiFeature.value === 'custom' ? aiInstruction.value : '',
        tone: aiFeature.value === 'tone' ? aiTone.value : '',
        locale: locale.value
      }
    })
    aiResult.value = res.text
  } catch (err: unknown) {
    const data = (err as { data?: { code?: string, message?: string } })?.data
    aiError.value = data?.code
      ? t('editor.ai.failed') + ` (${data.code})`
      : (err as Error).message
  } finally {
    aiRunning.value = false
  }
}

function replaceSelection(): void {
  const e = editor.value
  if (!e || !aiRange.value || !aiResult.value) return
  e.chain().focus()
    .insertContentAt({ from: aiRange.value.from, to: aiRange.value.to }, aiResult.value)
    .run()
  aiOpen.value = false
  aiResult.value = ''
}

function insertBelow(): void {
  const e = editor.value
  if (!e || !aiResult.value) return
  e.chain().focus()
    .insertContentAt(e.state.selection.to, { type: 'paragraph', content: [{ type: 'text', text: aiResult.value }] })
    .run()
  aiOpen.value = false
  aiResult.value = ''
}
</script>

<template>
  <div class="overflow-hidden rounded-md border border-input shadow-sm focus-within:ring-1 focus-within:ring-ring">
    <div class="flex items-center gap-1 border-b bg-muted/40 px-1.5 py-1">
      <button
        v-for="m in (['rich', 'markdown', 'preview'] as const)"
        :key="m"
        type="button"
        class="rounded px-2 py-1 text-xs transition-colors"
        :class="mode === m ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent'"
        @click="switchMode(m)"
      >
        {{ t(`editor.mode.${m}`) }}
      </button>
      <button
        type="button"
        class="ml-2 rounded px-2 py-1 text-xs text-amber-600 hover:bg-accent"
        title="Paid content"
        :disabled="props.disabled"
        @click="openPaidDialog"
      >
        [paid]
      </button>
    </div>
    <div
      v-if="editor && mode === 'rich'"
      class="flex items-center gap-1 overflow-x-auto border-b bg-muted/40 px-1.5 py-1"
    >
      <div
        v-for="(group, gi) in groups"
        :key="gi"
        class="flex shrink-0 items-center gap-0.5"
        :class="gi > 0 && 'ml-1 border-l pl-1.5'"
      >
        <button
          v-for="tool in group.buttons"
          :key="tool.label"
          type="button"
          :title="tool.label"
          :disabled="tool.disabled || props.disabled"
          :class="cn(
            'rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40',
            tool.active && 'bg-primary/10 text-primary'
          )"
          @mousedown.prevent
          @click="tool.run()"
        >
          <component
            :is="tool.icon"
            class="h-3.5 w-3.5"
          />
        </button>
      </div>
      <button
        type="button"
        class="ml-1 flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors"
        :class="aiOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
        :disabled="props.disabled"
        @mousedown.prevent
        @click="openAiPanel"
      >
        <SparklesIcon class="h-3.5 w-3.5" />
        {{ t('editor.ai.button') }}
      </button>
      <span class="ml-auto shrink-0 pr-1 text-[10px] tabular-nums text-muted-foreground">{{ t('editor.chars', { n: charCount }) }}</span>
    </div>

    <!-- AI panel (ADR 0005): selection AI with preview, never auto-write -->
    <div
      v-if="aiOpen"
      class="space-y-3 border-b bg-muted/20 p-3"
    >
      <div class="flex flex-wrap items-center gap-2">
        <p class="text-xs font-semibold text-foreground">
          {{ t('editor.ai.title') }}
        </p>
        <select
          v-model="aiFeature"
          class="ml-auto h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value="improve">
            Improve
          </option>
          <option value="rewrite">
            Rewrite
          </option>
          <option value="shorten">
            Shorten
          </option>
          <option value="expand">
            Expand
          </option>
          <option value="grammar">
            Fix grammar
          </option>
          <option value="clarify">
            Clarify
          </option>
          <option value="summarize">
            Summarize
          </option>
          <option value="tone">
            Change tone
          </option>
          <option value="custom">
            Custom…
          </option>
        </select>
        <select
          v-if="aiFeature === 'tone'"
          v-model="aiTone"
          class="h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option
            v-for="tone in AI_TONES"
            :key="tone"
            :value="tone"
          >
            {{ tone }}
          </option>
        </select>
        <button
          type="button"
          class="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          :disabled="aiRunning || props.disabled"
          @mousedown.prevent
          @click="runAi"
        >
          <Loader2Icon
            v-if="aiRunning"
            class="h-3.5 w-3.5 animate-spin"
          />
          {{ aiRunning ? t('editor.ai.running') : t('editor.ai.run') }}
        </button>
      </div>

      <input
        v-if="aiFeature === 'custom'"
        v-model="aiInstruction"
        :placeholder="t('editor.ai.instruction')"
        class="h-9 w-full rounded-md border bg-background px-3 text-sm"
        @keydown.enter.prevent="runAi"
      >

      <p
        v-if="aiError"
        class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive"
      >
        {{ aiError }}
      </p>

      <div
        v-if="aiResult"
        class="grid gap-3 sm:grid-cols-2"
      >
        <div class="rounded-md border bg-background p-3">
          <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {{ t('editor.ai.original') }}
          </p>
          <p class="whitespace-pre-line text-sm leading-relaxed">
            {{ aiRange?.text }}
          </p>
        </div>
        <div class="rounded-md border border-primary/40 bg-background p-3">
          <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
            {{ t('editor.ai.suggestion') }}
          </p>
          <p class="whitespace-pre-line text-sm leading-relaxed">
            {{ aiResult }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2 sm:col-span-2">
          <UiButton
            size="sm"
            @mousedown.prevent
            @click="replaceSelection"
          >
            {{ t('editor.ai.replace') }}
          </UiButton>
          <UiButton
            size="sm"
            variant="outline"
            @mousedown.prevent
            @click="insertBelow"
          >
            {{ t('editor.ai.insertBelow') }}
          </UiButton>
          <UiButton
            size="sm"
            variant="outline"
            @mousedown.prevent
            @click="runAi"
          >
            {{ t('editor.ai.retry') }}
          </UiButton>
        </div>
      </div>
    </div>
    <UiTextarea
      v-if="mode === 'markdown'"
      v-model="markdownSource"
      :rows="20"
      class="rounded-none border-0 font-mono focus-visible:ring-0"
    />
    <div
      v-else-if="mode === 'preview'"
      class="prose prose-sm dark:prose-invert min-h-[26rem] max-w-none p-3"
      v-html="previewHtml"
    />

    <EditorContent
      v-else
      :editor="editor"
      class="min-h-[26rem] [&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:underline [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:text-muted-foreground [&_.ProseMirror_h2]:mt-4 [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h3]:mt-3 [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_hr]:my-3 [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_p]:my-2 [&_.ProseMirror_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child]:before:float-left [&_.ProseMirror_p.is-editor-empty:first-child]:before:h-0 [&_.ProseMirror_p.is-editor-empty:first-child]:before:text-muted-foreground [&_.ProseMirror]:outline-none [&_.ProseMirror]:p-3 [&_.ProseMirror]:text-sm [&_.ProseMirror_.selectedCell]:bg-primary/10 [&_.ProseMirror_pre]:rounded-md [&_.ProseMirror_pre]:bg-muted [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_strong]:font-semibold [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:p-1.5 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:bg-muted/50 [&_.ProseMirror_th]:p-1.5 [&_.ProseMirror_th]:text-left [&_.ProseMirror_ul_[data-type=taskList]]:list-none [&_.ProseMirror_ul_[data-type=taskList]]:pl-1 [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5"
    />

    <!-- insert dialog (link / image / color) -->
    <DialogRoot
      :open="promptOpen"
      @update:open="(v: boolean) => (promptOpen = v)"
    >
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-50 bg-black/60" />
        <DialogContent class="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-5 shadow-lg focus:outline-none">
          <DialogTitle class="text-sm font-semibold">
            {{ promptTitle }}
          </DialogTitle>

          <form
            class="mt-4 space-y-4"
            @submit.prevent="applyPrompt"
          >
            <div
              v-if="promptKind !== 'color'"
              class="space-y-1.5"
            >
              <UiLabel for="editor-prompt-url">
                {{ promptKind === 'link' ? 'URL' : 'Image URL' }}
              </UiLabel>
              <UiInput
                id="editor-prompt-url"
                v-model="promptUrl"
                :placeholder="t('dialog.urlPlaceholder')"
              />
              <p
                v-if="promptUrl && !promptValid"
                class="text-xs text-destructive"
              >
                $t('dialog.urlInvalid')
              </p>
            </div>

            <div
              v-if="promptKind === 'image'"
              class="space-y-1.5"
            >
              <UiLabel for="editor-prompt-alt">
                Alt text (optional)
              </UiLabel>
              <UiInput
                id="editor-prompt-alt"
                v-model="promptAlt"
                :placeholder="t('dialog.altPlaceholder')"
              />
            </div>

            <div
              v-if="promptKind === 'color'"
              class="space-y-2"
            >
              <div class="flex items-center gap-3">
                <input
                  v-model="promptColorHex"
                  type="color"
                  class="h-9 w-14 cursor-pointer rounded-md border border-input bg-transparent p-1"
                >
                <UiInput
                  v-model="promptColorHex"
                  class="flex-1 font-mono text-xs"
                />
              </div>
              <div class="flex gap-1.5">
                <button
                  v-for="swatch in ['#111111', '#d64545', '#d97706', '#16a34a', '#2563eb', '#7c3aed']"
                  :key="swatch"
                  type="button"
                  class="h-6 w-6 rounded-full border border-border transition-transform hover:scale-110"
                  :style="{ background: swatch }"
                  :aria-label="`Set color ${swatch}`"
                  @click="promptColorHex = swatch"
                />
              </div>
            </div>

            <div class="flex justify-end gap-2 border-t pt-4">
              <UiButton
                type="button"
                variant="outline"
                size="sm"
                @click="promptOpen = false"
              >
                {{ t('common.cancel') }}
              </UiButton>
              <UiButton
                type="submit"
                size="sm"
                :disabled="!promptValid"
              >
                {{ t('dialog.apply') }}
              </UiButton>
            </div>
          </form>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <!-- paid content dialog -->
    <DialogRoot
      :open="paidOpen"
      @update:open="(v: boolean) => (paidOpen = v)"
    >
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-50 bg-black/60" />
        <DialogContent class="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-5 shadow-lg focus:outline-none">
          <DialogTitle class="text-sm font-semibold">
            {{ t('dialog.paidContent') }}
          </DialogTitle>
          <form
            class="mt-4 space-y-4"
            @submit.prevent="applyPaid"
          >
            <div class="space-y-1.5">
              <UiLabel for="paid-price">
                {{ t('dialog.paidPrice') }}
              </UiLabel>
              <UiInput
                id="paid-price"
                v-model="paidPriceText"
                type="number"
                min="1"
                :placeholder="t('dialog.paidPriceHint')"
              />
              <p class="text-xs text-muted-foreground">
                {{ t('dialog.paidPriceHint2') }}
              </p>
            </div>
            <div class="space-y-1.5">
              <UiLabel for="paid-currency">
                {{ t('dialog.paidCurrency') }}
              </UiLabel>
              <select
                id="paid-currency"
                v-model="paidCurrency"
                class="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="USD">
                  USD
                </option>
                <option value="CNY">
                  CNY
                </option>
                <option value="EUR">
                  EUR
                </option>
              </select>
            </div>
            <div class="flex justify-end gap-2 border-t pt-4">
              <UiButton
                type="button"
                variant="outline"
                size="sm"
                @click="paidOpen = false"
              >
                {{ t('common.cancel') }}
              </UiButton>
              <UiButton
                type="submit"
                size="sm"
                :disabled="paidPrice === null"
              >
                {{ t('dialog.apply') }}
              </UiButton>
            </div>
          </form>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
