from pathlib import Path

p = Path('android-admin/app/src/main/java/com/darktv/admin/MainActivity.java')
s = p.read_text(encoding='utf-8')

if 'import android.text.method.PasswordTransformationMethod;' not in s:
    s = s.replace(
        'import android.text.InputType;\n',
        'import android.text.InputType;\nimport android.text.method.PasswordTransformationMethod;\n'
    )

old_device = '''        deviceInput.setInputType(\n            InputType.TYPE_CLASS_TEXT |\n            InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS\n        );\n\n        /*\n         * Não formatar o MAC a cada tecla.\n         * Alterar o texto com setText() enquanto o IME está compondo\n         * interrompe a digitação em alguns teclados Android.\n         * A normalização continua acontecendo ao liberar o acesso.\n         */\n        deviceInput.setOnFocusChangeListener((v, hasFocus) -> {\n            if (!hasFocus) {\n                String formatted =\n                    formatDeviceInput(\n                        deviceInput.getText().toString()\n                    );\n\n                deviceInput.setText(formatted);\n                deviceInput.setSelection(\n                    formatted.length()\n                );\n            }\n        });\n'''

new_device = '''        /*\n         * Entrada crua e estável: o app não reinicia a conexão com o IME\n         * nem reescreve o texto enquanto o usuário está digitando.\n         * O MAC é normalizado somente quando LIBERAR ACESSO é pressionado.\n         */\n        deviceInput.setRawInputType(\n            InputType.TYPE_CLASS_TEXT |\n            InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD |\n            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS\n        );\n        deviceInput.setImeOptions(\n            EditorInfo.IME_ACTION_NEXT |\n            EditorInfo.IME_FLAG_NO_EXTRACT_UI |\n            EditorInfo.IME_FLAG_NO_FULLSCREEN |\n            EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING\n        );\n'''

if old_device not in s:
    raise SystemExit('bloco deviceInput esperado não encontrado')
s = s.replace(old_device, new_device, 1)

for target in [
    '''        passInput.setInputType(\n            InputType.TYPE_CLASS_TEXT |\n            InputType.TYPE_TEXT_VARIATION_PASSWORD |\n            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS\n        );\n''',
    '''        adminKeyInput.setInputType(\n            InputType.TYPE_CLASS_TEXT |\n            InputType.TYPE_TEXT_VARIATION_PASSWORD |\n            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS\n        );\n''',
    '''        githubTokenInput.setInputType(\n            InputType.TYPE_CLASS_TEXT |\n            InputType.TYPE_TEXT_VARIATION_PASSWORD |\n            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS\n        );\n'''
]:
    if target not in s:
        raise SystemExit('bloco de senha esperado não encontrado')

s = s.replace(
    '''        passInput.setInputType(\n            InputType.TYPE_CLASS_TEXT |\n            InputType.TYPE_TEXT_VARIATION_PASSWORD |\n            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS\n        );\n''',
    '''        passInput.setTransformationMethod(\n            PasswordTransformationMethod.getInstance()\n        );\n''',
    1
)
s = s.replace(
    '''        adminKeyInput.setInputType(\n            InputType.TYPE_CLASS_TEXT |\n            InputType.TYPE_TEXT_VARIATION_PASSWORD |\n            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS\n        );\n''',
    '''        adminKeyInput.setTransformationMethod(\n            PasswordTransformationMethod.getInstance()\n        );\n''',
    1
)
s = s.replace(
    '''        githubTokenInput.setInputType(\n            InputType.TYPE_CLASS_TEXT |\n            InputType.TYPE_TEXT_VARIATION_PASSWORD |\n            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS\n        );\n''',
    '''        githubTokenInput.setTransformationMethod(\n            PasswordTransformationMethod.getInstance()\n        );\n''',
    1
)

old_field = '''        e.setInputType(\n            InputType.TYPE_CLASS_TEXT |\n            InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD |\n            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS\n        );\n        e.setImeOptions(EditorInfo.IME_ACTION_NEXT);\n'''
new_field = '''        e.setRawInputType(\n            InputType.TYPE_CLASS_TEXT |\n            InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD |\n            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS\n        );\n        e.setImeOptions(\n            EditorInfo.IME_ACTION_NEXT |\n            EditorInfo.IME_FLAG_NO_EXTRACT_UI |\n            EditorInfo.IME_FLAG_NO_FULLSCREEN |\n            EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING\n        );\n'''
if old_field not in s:
    raise SystemExit('helper field esperado não encontrado')
s = s.replace(old_field, new_field, 1)

p.write_text(s, encoding='utf-8')
print('Admin keyboard fix aplicado')
