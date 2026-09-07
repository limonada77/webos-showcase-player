package com.darktv.admin;

import android.app.Activity;
import android.graphics.Color;
import android.content.Intent;
import android.os.Bundle;
import android.text.InputType;
import android.text.method.PasswordTransformationMethod;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

public class MainActivity extends Activity {

    private static final int REGISTERED_DEVICES_REQUEST = 7001;

    private static final String ACCESS_URL =
        "https://mabdjbzjgsjxbdhrkvmb.supabase.co/functions/v1/grant-access";

    private static final String CONFIG_KEY_B64 =
        "orcOggT4W+iiKh5m3/MWqYipHn29xcnjgXV7iAdETjY=";

    private EditText deviceInput;
    private EditText hostInput;
    private EditText userInput;
    private EditText passInput;
    private EditText adminKeyInput;
    private Spinner durationSpinner;
    private TextView status;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.rgb(9, 9, 11));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(24), dp(32), dp(24), dp(36));
        scroll.addView(root);

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(android.view.Gravity.CENTER_VERTICAL);

        TextView title = text("DarkTV Admin", 30, true);
        LinearLayout.LayoutParams titleParams =
            new LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
            );
        title.setLayoutParams(titleParams);
        header.addView(title);

        Button registeredButton = new Button(this);
        registeredButton.setText("⋮");
        registeredButton.setTextSize(26);
        registeredButton.setTextColor(Color.WHITE);
        registeredButton.setBackgroundColor(Color.rgb(32, 32, 36));
        registeredButton.setContentDescription("MACs registrados");
        registeredButton.setOnClickListener(v -> {
            Intent intent =
                new Intent(
                    MainActivity.this,
                    RegisteredDevicesActivity.class
                );

            startActivityForResult(
                intent,
                REGISTERED_DEVICES_REQUEST
            );
        });

        LinearLayout.LayoutParams menuParams =
            new LinearLayout.LayoutParams(
                dp(58),
                dp(52)
            );
        registeredButton.setLayoutParams(menuParams);
        header.addView(registeredButton);

        root.addView(header);

        TextView sub = text(
            "Controle o acesso pelo Supabase e, se quiser, envie a lista Xtream direto para o aparelho.",
            15,
            false
        );
        sub.setTextColor(Color.LTGRAY);
        sub.setPadding(0, dp(8), 0, dp(22));
        root.addView(sub);

        deviceInput = field("MAC / ID (pode digitar sem :)");
        root.addView(deviceInput);

        TextView durationTitle = text("Tempo de acesso", 15, true);
        durationTitle.setPadding(0, dp(4), 0, dp(8));
        root.addView(durationTitle);

        durationSpinner = new Spinner(this);
        durationSpinner.setBackgroundColor(Color.rgb(32, 32, 36));

        String[] durations = new String[] {
            "4 horas",
            "1 mês",
            "1 ano",
            "Para sempre",
            "Bloquear acesso"
        };

        ArrayAdapter<String> durationAdapter =
            new ArrayAdapter<String>(
                this,
                android.R.layout.simple_spinner_item,
                durations
            ) {
                @Override
                public View getView(
                    int position,
                    View convertView,
                    ViewGroup parent
                ) {
                    return styleDurationView(
                        super.getView(position, convertView, parent)
                    );
                }

                @Override
                public View getDropDownView(
                    int position,
                    View convertView,
                    ViewGroup parent
                ) {
                    return styleDurationView(
                        super.getDropDownView(position, convertView, parent)
                    );
                }
            };

        durationAdapter.setDropDownViewResource(
            android.R.layout.simple_spinner_dropdown_item
        );
        durationSpinner.setAdapter(durationAdapter);

        LinearLayout.LayoutParams spinnerParams =
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(54)
            );
        spinnerParams.bottomMargin = dp(20);
        durationSpinner.setLayoutParams(spinnerParams);
        root.addView(durationSpinner);

        TextView listTitle = text("Lista Xtream (opcional)", 18, true);
        root.addView(listTitle);

        TextView listHelp = text(
            "Preencha servidor, usuário e senha para a lista entrar automaticamente nesse MAC.",
            13,
            false
        );
        listHelp.setTextColor(Color.GRAY);
        listHelp.setPadding(0, dp(6), 0, dp(12));
        root.addView(listHelp);

        hostInput = field("Servidor / DNS (http://host:porta)");
        hostInput.setRawInputType(
            InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_VARIATION_URI |
            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        );

        userInput = field("Usuário da lista");
        passInput = field("Senha da lista");
        passInput.setTransformationMethod(
            PasswordTransformationMethod.getInstance()
        );

        root.addView(hostInput);
        root.addView(userInput);
        root.addView(passInput);

        Button grant = button("APLICAR NO APARELHO");
        grant.setOnClickListener(v -> grantAccess());
        root.addView(grant);

        status = text("", 14, true);
        status.setPadding(0, dp(14), 0, dp(28));
        root.addView(status);

        TextView settingsTitle = text("Configuração do Admin", 18, true);
        root.addView(settingsTitle);

        TextView settingsHelp = text(
            "Agora só precisa da Chave Admin DarkTV. Duração e lista por MAC ficam no Supabase; token GitHub não é mais usado.",
            13,
            false
        );
        settingsHelp.setTextColor(Color.GRAY);
        settingsHelp.setPadding(0, dp(6), 0, dp(12));
        root.addView(settingsHelp);

        adminKeyInput = field("Chave Admin DarkTV");
        adminKeyInput.setTransformationMethod(
            PasswordTransformationMethod.getInstance()
        );

        String savedAdminKey =
            getSharedPreferences("admin", MODE_PRIVATE)
                .getString("darktv_admin_key", "");

        adminKeyInput.setText(savedAdminKey);
        root.addView(adminKeyInput);

        Button save = button("SALVAR CHAVE");
        save.setOnClickListener(v -> {
            getSharedPreferences("admin", MODE_PRIVATE)
                .edit()
                .putString(
                    "darktv_admin_key",
                    adminKeyInput.getText().toString().trim()
                )
                .apply();

            status.setText("Chave salva neste celular.");
            status.setTextColor(Color.rgb(134, 239, 172));
        });
        root.addView(save);

        setContentView(scroll);
    }

    @Override
    protected void onActivityResult(
        int requestCode,
        int resultCode,
        Intent data
    ) {
        super.onActivityResult(
            requestCode,
            resultCode,
            data
        );

        if (
            requestCode == REGISTERED_DEVICES_REQUEST &&
            resultCode == RESULT_OK &&
            data != null
        ) {
            String selected =
                data.getStringExtra(
                    "selected_device_id"
                );

            if (
                selected != null &&
                !selected.trim().isEmpty()
            ) {
                deviceInput.setText(
                    normalizeDeviceId(selected)
                );
                deviceInput.requestFocus();

                status.setText(
                    "MAC / ID selecionado: " +
                    normalizeDeviceId(selected)
                );
                status.setTextColor(
                    Color.rgb(134, 239, 172)
                );
            }
        }
    }

    private void grantAccess() {
        final String device =
            normalizeDeviceId(deviceInput.getText().toString());

        final String adminKey =
            adminKeyInput.getText().toString().trim();

        final String host =
            normalizeHost(hostInput.getText().toString());

        final String user =
            userInput.getText().toString().trim();

        final String pass =
            passInput.getText().toString().trim();

        if (device.isEmpty()) {
            fail("Digite o MAC / ID da TV.");
            return;
        }

        if (device.replace(":", "").length() != 12) {
            fail("MAC / ID incompleto. Digite os 12 caracteres.");
            return;
        }

        if (adminKey.isEmpty()) {
            fail("Salve primeiro a Chave Admin.");
            return;
        }

        final String duration = selectedDuration();
        final boolean blocking = "block".equals(duration);

        final boolean hasAnyListField =
            !host.isEmpty() || !user.isEmpty() || !pass.isEmpty();

        if (
            !blocking &&
            hasAnyListField &&
            (host.isEmpty() || user.isEmpty() || pass.isEmpty())
        ) {
            fail("Para enviar a lista, preencha servidor, usuário e senha.");
            return;
        }

        final String expiresAt =
            calculateExpiresAt(duration);

        status.setText(
            blocking
                ? "Bloqueando acesso..."
                : "Enviando para o Supabase..."
        );
        status.setTextColor(Color.rgb(250, 204, 21));

        new Thread(() -> {
            try {
                String hash = sha256(device);
                String encryptedXtream = null;

                if (!blocking && hasAnyListField) {
                    JSONObject xtream = new JSONObject();
                    xtream.put("host", host);
                    xtream.put("user", user);
                    xtream.put("pass", pass);

                    encryptedXtream =
                        encryptConfig(xtream.toString());
                }

                if (blocking) {
                    updateAccessBackend(
                        adminKey,
                        hash,
                        false,
                        "block",
                        null
                    );

                    runOnUiThread(() -> {
                        status.setText(
                            "Acesso bloqueado para " + device +
                            ". O modal de pagamento volta a aparecer."
                        );
                        status.setTextColor(
                            Color.rgb(248, 113, 113)
                        );
                    });
                    return;
                }

                /*
                 * Pequeno pulso para aparelhos já abertos perceberem
                 * renovação/troca de lista e consultarem o Supabase de novo.
                 */
                updateAccessBackend(
                    adminKey,
                    hash,
                    false,
                    "block",
                    null
                );

                try {
                    Thread.sleep(2300);
                } catch (InterruptedException ignored) {}

                updateAccessBackend(
                    adminKey,
                    hash,
                    true,
                    duration,
                    encryptedXtream
                );

                final String expiryLabel =
                    "forever".equals(duration)
                        ? "para sempre"
                        : formatExpiryForUser(expiresAt);

                runOnUiThread(() -> {
                    String msg =
                        "Acesso liberado para " + device +
                        " — " + expiryLabel + ".";

                    if (hasAnyListField) {
                        msg += " Lista vinculada no Supabase.";
                    }

                    status.setText(msg);
                    status.setTextColor(
                        Color.rgb(134, 239, 172)
                    );
                });

            } catch (Exception e) {
                runOnUiThread(() ->
                    fail("Erro: " + e.getMessage())
                );
            }
        }).start();
    }

    private String selectedDuration() {
        int position =
            durationSpinner.getSelectedItemPosition();

        if (position == 0) return "hours4";
        if (position == 1) return "month";
        if (position == 2) return "year";
        if (position == 3) return "forever";
        return "block";
    }

    private String calculateExpiresAt(String duration) {
        if ("forever".equals(duration)) {
            return null;
        }

        Calendar cal = Calendar.getInstance();

        if ("hours4".equals(duration)) {
            cal.add(Calendar.HOUR_OF_DAY, 4);
        } else if ("year".equals(duration)) {
            cal.add(Calendar.YEAR, 1);
        } else if ("month".equals(duration)) {
            cal.add(Calendar.MONTH, 1);
        }

        SimpleDateFormat iso =
            new SimpleDateFormat(
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                Locale.US
            );

        iso.setTimeZone(TimeZone.getTimeZone("UTC"));
        return iso.format(cal.getTime());
    }

    private String formatExpiryForUser(String isoValue) {
        if (isoValue == null) return "para sempre";

        try {
            SimpleDateFormat iso =
                new SimpleDateFormat(
                    "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                    Locale.US
                );
            iso.setTimeZone(TimeZone.getTimeZone("UTC"));

            Date date = iso.parse(isoValue);

            SimpleDateFormat local =
                new SimpleDateFormat(
                    "dd/MM/yyyy HH:mm",
                    Locale.getDefault()
                );

            return "até " + local.format(date);
        } catch (Exception e) {
            return "com vencimento";
        }
    }

    private String normalizeHost(String value) {
        String host =
            value == null ? "" : value.trim();

        while (host.endsWith("/")) {
            host = host.substring(0, host.length() - 1);
        }

        if (
            !host.isEmpty() &&
            !host.startsWith("http://") &&
            !host.startsWith("https://")
        ) {
            host = "http://" + host;
        }

        return host;
    }

    private String encryptConfig(String plain)
        throws Exception {

        byte[] key =
            Base64.decode(
                CONFIG_KEY_B64,
                Base64.DEFAULT
            );

        byte[] iv = new byte[12];
        new SecureRandom().nextBytes(iv);

        Cipher cipher =
            Cipher.getInstance("AES/GCM/NoPadding");

        cipher.init(
            Cipher.ENCRYPT_MODE,
            new SecretKeySpec(key, "AES"),
            new GCMParameterSpec(128, iv)
        );

        byte[] encrypted =
            cipher.doFinal(
                plain.getBytes(StandardCharsets.UTF_8)
            );

        return "v1." +
            Base64.encodeToString(
                iv,
                Base64.NO_WRAP
            ) +
            "." +
            Base64.encodeToString(
                encrypted,
                Base64.NO_WRAP
            );
    }

    private void updateAccessBackend(
        String adminKey,
        String deviceHash,
        boolean active,
        String duration,
        String encryptedXtream
    ) throws Exception {

        HttpURLConnection c =
            (HttpURLConnection)
                new URL(ACCESS_URL)
                    .openConnection();

        c.setRequestMethod("POST");
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        c.setDoOutput(true);

        c.setRequestProperty(
            "Content-Type",
            "application/json; charset=utf-8"
        );

        c.setRequestProperty(
            "x-admin-key",
            adminKey
        );

        JSONObject payload =
            new JSONObject();

        payload.put("device_hash", deviceHash);
        payload.put("active", active);
        payload.put(
            "duration",
            active ? duration : "block"
        );

        if (
            active &&
            encryptedXtream != null &&
            !encryptedXtream.isEmpty()
        ) {
            payload.put(
                "xtream_enc",
                encryptedXtream
            );
        }

        try (OutputStream out =
            c.getOutputStream()) {

            out.write(
                payload.toString()
                    .getBytes(StandardCharsets.UTF_8)
            );
        }

        int code = c.getResponseCode();

        if (code != 200) {
            String body = readBody(c);

            if (code == 401) {
                throw new Exception(
                    "Chave Admin inválida."
                );
            }

            throw new Exception(
                "Backend HTTP " +
                code + ": " + body
            );
        }
    }

    private String readBody(
        HttpURLConnection c
    ) throws Exception {

        InputStream in =
            c.getErrorStream() != null
                ? c.getErrorStream()
                : c.getInputStream();

        if (in == null) return "";

        BufferedReader reader =
            new BufferedReader(
                new InputStreamReader(
                    in,
                    StandardCharsets.UTF_8
                )
            );

        StringBuilder out =
            new StringBuilder();

        String line;

        while ((line = reader.readLine()) != null) {
            out.append(line);
        }

        reader.close();
        return out.toString();
    }

    private String normalizeDeviceId(
        String value
    ) {
        String raw =
            value == null
                ? ""
                : value.toUpperCase(Locale.US);

        String hex =
            raw.replaceAll("[^0-9A-F]", "");

        if (hex.length() > 12) {
            hex = hex.substring(0, 12);
        }

        StringBuilder out =
            new StringBuilder();

        for (int i = 0; i < hex.length(); i++) {
            if (i > 0 && i % 2 == 0) {
                out.append(":");
            }

            out.append(hex.charAt(i));
        }

        return out.toString();
    }

    private String sha256(
        String value
    ) throws Exception {

        MessageDigest digest =
            MessageDigest.getInstance("SHA-256");

        byte[] bytes =
            digest.digest(
                value.getBytes(StandardCharsets.UTF_8)
            );

        StringBuilder out =
            new StringBuilder();

        for (byte b : bytes) {
            out.append(
                String.format(
                    Locale.US,
                    "%02x",
                    b & 0xff
                )
            );
        }

        return out.toString();
    }

    private View styleDurationView(View view) {
        if (view instanceof TextView) {
            TextView tv = (TextView) view;

            tv.setTextSize(17);
            tv.setPadding(
                dp(16),
                dp(12),
                dp(16),
                dp(12)
            );
            tv.setBackgroundColor(
                Color.rgb(32, 32, 36)
            );

            if (
                "Bloquear acesso".contentEquals(
                    tv.getText()
                )
            ) {
                tv.setTextColor(
                    Color.rgb(248, 113, 113)
                );
            } else {
                tv.setTextColor(Color.WHITE);
            }
        }

        return view;
    }

    private void fail(String message) {
        status.setText(message);
        status.setTextColor(
            Color.rgb(248, 113, 113)
        );
    }

    private TextView text(
        String value,
        int sp,
        boolean bold
    ) {
        TextView v =
            new TextView(this);

        v.setText(value);
        v.setTextSize(sp);
        v.setTextColor(Color.WHITE);

        if (bold) {
            v.setTypeface(
                v.getTypeface(),
                android.graphics.Typeface.BOLD
            );
        }

        return v;
    }

    private EditText field(
        String hint
    ) {
        EditText e =
            new EditText(this);

        e.setHint(hint);
        e.setTextColor(Color.WHITE);
        e.setSingleLine(true);

        /*
         * Não reescreve o conteúdo enquanto o usuário digita.
         * Isso evita o teclado voltar para letras/interromper a digitação.
         */
        e.setRawInputType(
            InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD |
            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        );

        e.setImeOptions(
            EditorInfo.IME_ACTION_NEXT |
            EditorInfo.IME_FLAG_NO_EXTRACT_UI |
            EditorInfo.IME_FLAG_NO_FULLSCREEN |
            EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
        );

        e.setHintTextColor(
            Color.rgb(113, 113, 122)
        );

        e.setBackgroundColor(
            Color.rgb(32, 32, 36)
        );

        e.setPadding(
            dp(14),
            0,
            dp(14),
            0
        );

        LinearLayout.LayoutParams p =
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(54)
            );

        p.bottomMargin = dp(12);
        e.setLayoutParams(p);

        return e;
    }

    private Button button(
        String label
    ) {
        Button b =
            new Button(this);

        b.setText(label);
        b.setTextColor(Color.WHITE);
        b.setBackgroundColor(
            Color.rgb(229, 9, 20)
        );

        LinearLayout.LayoutParams p =
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(54)
            );

        p.bottomMargin = dp(8);
        b.setLayoutParams(p);

        return b;
    }

    private int dp(int value) {
        return (int) (
            value *
            getResources()
                .getDisplayMetrics()
                .density
        );
    }
}
