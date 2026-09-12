import io

# 1. register ai module
p = 'app/plugins/admin.ts'
src = io.open(p, encoding='utf-8').read()
old = "import backupModule from '~/modules/backup/module'"
new = "import backupModule from '~/modules/backup/module'\nimport aiModule from '~/modules/ai/module'"
assert old in src
src = src.replace(old, new)
old = "    sliderModule, backupModule\n  ]"
new = "    sliderModule, backupModule, aiModule\n  ]"
assert old in src
src = src.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='\n').write(src)

# 2. i18n: group.ai + res.ai.* + editor.ai.*
p = 'app/admin/i18n/index.ts'
src = io.open(p, encoding='utf-8').read()
zh = "    'group.system': '系统',"
zh_new = """    'group.system': '系统',
    'group.ai': 'AI',"""
assert zh in src, 'zh group'
src = src.replace(zh, zh_new, 1)
zh2 = "    'res.backup.label': '备份与恢复',"
zh2_new = """    'res.ai.label': 'AI 设置',
    'res.ai.provider': 'AI 提供方',
    'res.ai.newProvider': '新建提供方',
    'res.ai.name': '名称',
    'res.ai.type': '类型',
    'res.ai.typeCompatible': 'OpenAI 兼容',
    'res.ai.baseUrl': 'Base URL',
    'res.ai.apiKey': 'API Key',
    'res.ai.apiKeyKeep': '留空保留现有 Key',
    'res.ai.model': '默认模型',
    'res.ai.enabled': '启用',
    'res.ai.test': '测试连接',
    'res.ai.testOk': '连接成功 · {model} · {ms}ms',
    'res.ai.testFailed': '连接失败：{msg}',
    'res.ai.saved': '已保存',
    'res.ai.saveFailed': '保存失败',
    'res.ai.noProvider': '尚未配置 AI 提供方。',
    'res.ai.usage': '最近使用',
    'res.ai.noUsage': '暂无调用记录。',
    'editor.ai.button': 'AI',
    'editor.ai.title': 'AI 助手',
    'editor.ai.feature': '操作',
    'editor.ai.tone': '语气',
    'editor.ai.instruction': '自定义指令',
    'editor.ai.run': '运行',
    'editor.ai.running': 'AI 处理中…',
    'editor.ai.needSelection': '请先选中一段文字',
    'editor.ai.needSelectionRoot': '选中文本后可使用 AI；未选中时请框选要处理的内容',
    'editor.ai.original': '原文',
    'editor.ai.suggestion': 'AI 建议',
    'editor.ai.replace': '替换选中',
    'editor.ai.insertBelow': '插入下方',
    'editor.ai.retry': '重试',
    'editor.ai.noProvider': '尚未配置 AI 提供方（AI 设置）。',
    'editor.ai.failed': 'AI 调用失败',"""
assert zh2 in src, 'zh res.ai'
src = src.replace(zh2, zh2_new, 1)
en = "    'group.system': 'System',"
en_new = """    'group.system': 'System',
    'group.ai': 'AI',"""
assert en in src, 'en group'
src = src.replace(en, en_new, 1)
en2 = "    'res.backup.label': 'Backup & restore',"
en2_new = """    'res.ai.label': 'AI settings',
    'res.ai.provider': 'AI provider',
    'res.ai.newProvider': 'New provider',
    'res.ai.name': 'Name',
    'res.ai.type': 'Type',
    'res.ai.typeCompatible': 'OpenAI-compatible',
    'res.ai.baseUrl': 'Base URL',
    'res.ai.apiKey': 'API key',
    'res.ai.apiKeyKeep': 'leave empty to keep the stored key',
    'res.ai.model': 'Default model',
    'res.ai.enabled': 'Enabled',
    'res.ai.test': 'Test connection',
    'res.ai.testOk': 'Connected · {model} · {ms}ms',
    'res.ai.testFailed': 'Test failed: {msg}',
    'res.ai.saved': 'Saved',
    'res.ai.saveFailed': 'Save failed',
    'res.ai.noProvider': 'No AI provider configured yet.',
    'res.ai.usage': 'Recent usage',
    'res.ai.noUsage': 'No AI calls yet.',
    'editor.ai.button': 'AI',
    'editor.ai.title': 'AI assistant',
    'editor.ai.feature': 'Operation',
    'editor.ai.tone': 'Tone',
    'editor.ai.instruction': 'Custom instruction',
    'editor.ai.run': 'Run',
    'editor.ai.running': 'AI is working…',
    'editor.ai.needSelection': 'Select some text first',
    'editor.ai.needSelectionRoot': 'Select text to use AI',
    'editor.ai.original': 'Original',
    'editor.ai.suggestion': 'AI suggestion',
    'editor.ai.replace': 'Replace selection',
    'editor.ai.insertBelow': 'Insert below',
    'editor.ai.retry': 'Retry',
    'editor.ai.noProvider': 'No AI provider configured (AI settings).',
    'editor.ai.failed': 'AI call failed',"""
assert en2 in src, 'en res.ai'
src = src.replace(en2, en2_new, 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(src)
print('i18n ok')
