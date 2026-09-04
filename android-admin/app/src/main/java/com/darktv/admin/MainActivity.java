package com.darktv.admin;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.util.Base64;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

public class MainActivity extends Activity {

    private static final String ACCESS_URL =
        "https://mabdjbzjgsjxbdhrkvmb.supabase.co/functions/v1/grant-access";

    private EditText deviceInput;
    private EditText tokenInput;
    private TextView status;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.rgb(9, 9, 11));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(24), dp(36), dp(24), dp(36));
        scroll.addView(root);

        TextView title = text("StreamTV Admin", 30, true);
        root.addView(title);

        TextView sub = text(
            "Digite o MAC / ID mostrado na TV e toque em Liberar acesso.",
            15,
            false
        );
        sub.setTextColor(Color.LTGRAY);
        sub.setPadding(0, dp(8), 0, dp(24));
        root.addView(sub);

        deviceInput = field("MAC / ID do dispositivo");
        deviceInput.setSingleLine(true);
        deviceInput.setInputType(
            InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
        );

        /* ERICKTV_ADMIN_MAC_FORMAT_V2
         * Aceita MAC digitado/colado com ou sem : - espaço etc.
         * Converte ao vivo para MAIÚSCULO e adiciona : automaticamente.
         */
        deviceInput.addTextChangedListener(new TextWatcher() {
            private boolean changing = false;

            @Override
            public void beforeTextChanged(
                CharSequence s,
                int start,
                int count,
                int after
            ) {}

            @Override
            public void onTextChanged(
                CharSequence s,
                int start,
                int before,
                int count
            ) {}

            @Override
            public void afterTextChanged(Editable s) {
                if (changing) return;

                String formatted =
                    formatDeviceInput(s.toString());

                if (!formatted.equals(s.toString())) {
                    changing = true;
                    deviceInput.setText(formatted);
                    deviceInput.setSelection(
                        formatted.length()
                    );
                    changing = false;
                }
            }
        });

        root.addView(deviceInput);

        Button grant = button("LIBERAR ACESSO");
        grant.setOnClickListener(v -> grantAccess());
        root.addView(grant);

        status = text("", 14, true);
        status.setPadding(0, dp(14), 0, dp(30));
        root.addView(status);

        TextView settingsTitle = text("Configuração do acesso", 18, true);
        root.addView(settingsTitle);

        TextView settingsHelp = text(
            "Na primeira vez, informe a Chave Admin do DarkTV. Ela fica salva apenas neste celular.",
            13,
            false
        );
        settingsHelp.setTextColor(Color.GRAY);
        settingsHelp.setPadding(0, dp(6), 0, dp(12));
        root.addView(settingsHelp);

        tokenInput = field("Chave Admin DarkTV");
        tokenInput.setInputType(
            InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_VARIATION_PASSWORD
        );

        String savedToken =
            getSharedPreferences("admin", MODE_PRIVATE)
                .getString("darktv_admin_key", "");

        tokenInput.setText(savedToken);
        root.addView(tokenInput);

        Button saveToken = button("SALVAR TOKEN");
        saveToken.setOnClickListener(v -> {
            String token = tokenInput.getText().toString().trim();

            getSharedPreferences("admin", MODE_PRIVATE)
                .edit()
                .putString("darktv_admin_key", token)
                .apply();

            status.setText("Chave Admin salva neste celular.");
            status.setTextColor(Color.rgb(134, 239, 172));
        });
        root.addView(saveToken);

        setContentView(scroll);
    }

    private void grantAccess() {
        String device =
            normalizeDeviceId(deviceInput.getText().toString());

        String token =
            tokenInput.getText().toString().trim();

        if (device.isEmpty()) {
            fail("Digite o MAC / ID da TV.");
            return;
        }

        if (device.replace(":", "").length() != 12) {
            fail("MAC / ID incompleto. Digite os 12 caracteres.");
            return;
        }

        if (token.isEmpty()) {
            fail("Salve primeiro a Chave Admin.");
            return;
        }

        status.setText("Liberando...");
        status.setTextColor(Color.rgb(250, 204, 21));

        new Thread(() -> {
            try {
                String hash = sha256(device);
                updateAccessBackend(token, hash);

                runOnUiThread(() -> {
                    status.setText(
                        "Acesso liberado para " + device +
                        ". A TV deve desbloquear em poucos segundos."
                    );
                    status.setTextColor(Color.rgb(134, 239, 172));
                });

            } catch (Exception e) {
                runOnUiThread(() ->
                    fail("Erro ao liberar: " + e.getMessage())
                );
            }
        }).start();
    }

    private void updateAccessBackend(
        String adminKey,
        String deviceHash
    ) throws Exception {

        HttpURLConnection c =
            (HttpURLConnection) new URL(ACCESS_URL).openConnection();

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

        JSONObject payload = new JSONObject();
        payload.put("device_hash", deviceHash);
        payload.put("active", true);

        try (OutputStream out = c.getOutputStream()) {
            out.write(
                payload.toString().getBytes(StandardCharsets.UTF_8)
            );
        }

        int code = c.getResponseCode();

        if (code != 200) {
            String body = readBody(c);

            if (code == 401) {
                throw new Exception("Chave Admin inválida.");
            }

            throw new Exception(
                "Backend HTTP " + code + ": " + body
            );
        }
    }

    private String readBody(HttpURLConnection c)
        throws Exception {

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

        StringBuilder out = new StringBuilder();
        String line;

        while ((line = reader.readLine()) != null) {
            out.append(line);
        }

        reader.close();
        return out.toString();
    }

    private String formatDeviceInput(String value) {
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

    private String normalizeDeviceId(String value) {
        return formatDeviceInput(value);
    }

    private String sha256(String value) throws Exception {
        MessageDigest digest =
            MessageDigest.getInstance("SHA-256");

        byte[] bytes =
            digest.digest(
                value.getBytes(StandardCharsets.UTF_8)
            );

        StringBuilder out = new StringBuilder();

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

    private void fail(String message) {
        status.setText(message);
        status.setTextColor(Color.rgb(248, 113, 113));
    }

    private TextView text(String value, int sp, boolean bold) {
        TextView v = new TextView(this);
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

    private EditText field(String hint) {
        EditText e = new EditText(this);
        e.setHint(hint);
        e.setTextColor(Color.WHITE);
        e.setHintTextColor(Color.rgb(113, 113, 122));
        e.setBackgroundColor(Color.rgb(32, 32, 36));
        e.setPadding(dp(14), 0, dp(14), 0);

        LinearLayout.LayoutParams p =
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(54)
            );

        p.bottomMargin = dp(14);
        e.setLayoutParams(p);

        return e;
    }

    private Button button(String label) {
        Button b = new Button(this);
        b.setText(label);
        b.setTextColor(Color.WHITE);
        b.setBackgroundColor(Color.rgb(229, 9, 20));

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
            getResources().getDisplayMetrics().density
        );
    }
}
