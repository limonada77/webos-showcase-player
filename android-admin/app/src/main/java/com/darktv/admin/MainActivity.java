package com.darktv.admin;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.text.method.PasswordTransformationMethod;
import android.util.Base64;
import android.view.inputmethod.EditorInfo;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
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

    private static final String ACCESS_URL =
        "https://mabdjbzjgsjxbdhrkvmb.supabase.co/functions/v1/grant-access";

    private static final String OWNER = "limonada77";
    private static final String REPO = "webos-showcase-player";
    private static final String CONFIG_PATH = "public/device-config.json";
    private static final String BRANCH = "main";

    /*
     * A lista Xtream não é publicada em texto puro no repositório.
     * O app da TV e o Admin compartilham esta chave apenas para
     * transportar a configuração cifrada.
     */
    private static final String CONFIG_KEY_B64 =
        "orcOggT4W+iiKh5m3/MWqYipHn29xcnjgXV7iAdETjY=";

    private EditText deviceInput;
    private EditText hostInput;
    private EditText userInput;
    private EditText passInput;
    private EditText adminKeyInput;
    private EditText githubTokenInput;
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

        TextView title = text("DarkTV Admin", 30, true);
        root.addView(title);

        TextView sub = text(
            "Libere o aparelho, escolha o tempo e, se quiser, envie a lista Xtream direto para ele.",
            15,
            false
        );
        sub.setTextColor(Color.LTGRAY);
        sub.setPadding(0, dp(8), 0, dp(22));
        root.addView(sub);

        deviceInput = field("MAC / ID do dispositivo");
        deviceInput.setSingleLine(true);
        /*
         * Entrada crua e estável: o app não reinicia a conexão com o IME
         * nem reescreve o texto enquanto o usuário está digitando.
         * O MAC é normalizado somente quando LIBERAR ACESSO é pressionado.
         */
        deviceInput.setRawInputType(
            InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD |
            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        );
        deviceInput.setImeOptions(
            EditorInfo.IME_ACTION_NEXT |
            EditorInfo.IME_FLAG_NO_EXTRACT_UI |
            EditorInfo.IME_FLAG_NO_FULLSCREEN |
            EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
        );

        root.addView(deviceInput);

        TextView durationTitle = text("Tempo de acesso", 15, true);
        durationTitle.setPadding(0, dp(4), 0, dp(8));
        root.addView(durationTitle);

        durationSpinner = new Spinner(this);
        String[] durations = new String[] {
            "1 mês",
            "1 ano",
            "Para sempre"
        };
        ArrayAdapter<String> durationAdapter =
            new ArrayAdapter<>(
                this,
                android.R.layout.simple_spinner_dropdown_item,
                durations
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
            "Preencha os 3 campos para a lista entrar automaticamente no aparelho após a liberação.",
            13,
            false
        );
        listHelp.setTextColor(Color.GRAY);
        listHelp.setPadding(0, dp(6), 0, dp(12));
        root.addView(listHelp);

        hostInput = field("Servidor / DNS (http://host:porta)");
        userInput = field("Usuário da lista");
        passInput = field("Senha da lista");
        passInput.setTransformationMethod(
            PasswordTransformationMethod.getInstance()
        );

        root.addView(hostInput);
        root.addView(userInput);
        root.addView(passInput);

        Button grant = button("LIBERAR ACESSO");
        grant.setOnClickListener(v -> grantAccess());
        root.addView(grant);

        status = text("", 14, true);
        status.setPadding(0, dp(14), 0, dp(28));
        root.addView(status);

        TextView settingsTitle = text("Configuração do Admin", 18, true);
        root.addView(settingsTitle);

        TextView settingsHelp = text(
            "A Chave Admin libera no Supabase. O token GitHub grava duração e lista remota. Ambos ficam salvos somente neste celular.",
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

        githubTokenInput = field("Token GitHub");
        githubTokenInput.setTransformationMethod(
            PasswordTransformationMethod.getInstance()
        );

        String savedAdminKey =
            getSharedPreferences("admin", MODE_PRIVATE)
                .getString("darktv_admin_key", "");

        String savedGithubToken =
            getSharedPreferences("admin", MODE_PRIVATE)
                .getString("github_token_v2", "");

        adminKeyInput.setText(savedAdminKey);
        githubTokenInput.setText(savedGithubToken);

        root.addView(adminKeyInput);
        root.addView(githubTokenInput);

        Button save = button("SALVAR CHAVES");
        save.setOnClickListener(v -> {
            getSharedPreferences("admin", MODE_PRIVATE)
                .edit()
                .putString(
                    "darktv_admin_key",
                    adminKeyInput.getText().toString().trim()
                )
                .putString(
                    "github_token_v2",
                    githubTokenInput.getText().toString().trim()
                )
                .apply();

            status.setText("Chaves salvas neste celular.");
            status.setTextColor(Color.rgb(134, 239, 172));
        });
        root.addView(save);

        setContentView(scroll);
    }

    private void grantAccess() {
        final String device =
            normalizeDeviceId(deviceInput.getText().toString());

        final String adminKey =
            adminKeyInput.getText().toString().trim();

        final String githubToken =
            githubTokenInput.getText().toString().trim();

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

        if (githubToken.isEmpty()) {
            fail("Informe o token GitHub para gravar duração/lista.");
            return;
        }

        boolean hasAnyListField =
            !host.isEmpty() || !user.isEmpty() || !pass.isEmpty();

        if (
            hasAnyListField &&
            (host.isEmpty() || user.isEmpty() || pass.isEmpty())
        ) {
            fail("Para enviar a lista, preencha servidor, usuário e senha.");
            return;
        }

        final String duration = selectedDuration();
        final String expiresAt = calculateExpiresAt(duration);

        status.setText("Gravando configuração...");
        status.setTextColor(Color.rgb(250, 204, 21));

        new Thread(() -> {
            try {
                String hash = sha256(device);

                String encryptedXtream = null;

                if (hasAnyListField) {
                    JSONObject xtream = new JSONObject();
                    xtream.put("host", host);
                    xtream.put("user", user);
                    xtream.put("pass", pass);

                    encryptedXtream =
                        encryptConfig(xtream.toString());
                }

                updateDeviceConfig(
                    githubToken,
                    hash,
                    duration,
                    expiresAt,
                    encryptedXtream
                );

                /*
                 * Pulso OFF -> ON:
                 * faz a versão nova da TV perceber também renovações
                 * e troca de lista em um aparelho que já estava ativo.
                 */
                updateAccessBackend(adminKey, hash, false);

                try {
                    Thread.sleep(3000);
                } catch (InterruptedException ignored) {}

                updateAccessBackend(adminKey, hash, true);

                final String expiryLabel =
                    "forever".equals(duration)
                        ? "para sempre"
                        : formatExpiryForUser(expiresAt);

                runOnUiThread(() -> {
                    String msg =
                        "Acesso liberado para " + device +
                        " — " + expiryLabel + ".";

                    if (hasAnyListField) {
                        msg += " Lista enviada para o aparelho.";
                    }

                    status.setText(msg);
                    status.setTextColor(Color.rgb(134, 239, 172));
                });

            } catch (Exception e) {
                runOnUiThread(() ->
                    fail("Erro ao liberar: " + e.getMessage())
                );
            }
        }).start();
    }

    private String selectedDuration() {
        int position = durationSpinner.getSelectedItemPosition();

        if (position == 1) return "year";
        if (position == 2) return "forever";
        return "month";
    }

    private String calculateExpiresAt(String duration) {
        if ("forever".equals(duration)) {
            return null;
        }

        Calendar cal = Calendar.getInstance();

        if ("year".equals(duration)) {
            cal.add(Calendar.YEAR, 1);
        } else {
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

    private void updateDeviceConfig(
        String token,
        String deviceHash,
        String duration,
        String expiresAt,
        String encryptedXtream
    ) throws Exception {

        String api =
            "https://api.github.com/repos/" +
            OWNER + "/" + REPO +
            "/contents/" + CONFIG_PATH +
            "?ref=" + BRANCH;

        HttpURLConnection get =
            openGitHub(api, "GET", token);

        int getCode = get.getResponseCode();

        JSONObject data;
        String fileSha = null;

        if (getCode == 200) {
            JSONObject file =
                new JSONObject(readBody(get));

            fileSha = file.getString("sha");

            String encoded =
                file.getString("content")
                    .replace("\n", "");

            String decoded =
                new String(
                    Base64.decode(
                        encoded,
                        Base64.DEFAULT
                    ),
                    StandardCharsets.UTF_8
                );

            data = new JSONObject(decoded);
        } else if (getCode == 404) {
            data = new JSONObject();
            data.put("version", 2);
            data.put("devices", new JSONArray());
        } else {
            throw new Exception(
                "GitHub GET HTTP " +
                getCode + ": " + readBody(get)
            );
        }

        JSONArray devices =
            data.optJSONArray("devices");

        if (devices == null) {
            devices = new JSONArray();
        }

        JSONObject existing = null;
        int existingIndex = -1;

        for (int i = 0; i < devices.length(); i++) {
            JSONObject item =
                devices.optJSONObject(i);

            if (
                item != null &&
                deviceHash.equalsIgnoreCase(
                    item.optString("hash")
                )
            ) {
                existing = item;
                existingIndex = i;
                break;
            }
        }

        JSONObject item =
            existing != null
                ? existing
                : new JSONObject();

        item.put("hash", deviceHash);
        item.put("active", true);
        item.put("duration", duration);
        item.put(
            "expiresAt",
            expiresAt == null
                ? JSONObject.NULL
                : expiresAt
        );
        item.put("source", "admin");
        item.put(
            "updatedAt",
            System.currentTimeMillis()
        );

        if (encryptedXtream != null) {
            item.put("xtream_enc", encryptedXtream);
        }

        if (existingIndex < 0) {
            devices.put(item);
        }

        data.put("version", 2);
        data.put("devices", devices);
        data.put(
            "updatedAt",
            System.currentTimeMillis()
        );

        JSONObject payload = new JSONObject();
        payload.put(
            "message",
            "Atualizar acesso remoto DarkTV"
        );
        payload.put(
            "content",
            Base64.encodeToString(
                data.toString(2)
                    .getBytes(StandardCharsets.UTF_8),
                Base64.NO_WRAP
            )
        );
        payload.put("branch", BRANCH);

        if (fileSha != null) {
            payload.put("sha", fileSha);
        }

        String putApi =
            "https://api.github.com/repos/" +
            OWNER + "/" + REPO +
            "/contents/" + CONFIG_PATH;

        HttpURLConnection put =
            openGitHub(
                putApi,
                "PUT",
                token
            );

        put.setDoOutput(true);
        put.setRequestProperty(
            "Content-Type",
            "application/json; charset=utf-8"
        );

        try (OutputStream out =
            put.getOutputStream()) {

            out.write(
                payload.toString()
                    .getBytes(StandardCharsets.UTF_8)
            );
        }

        int putCode = put.getResponseCode();

        if (putCode != 200 && putCode != 201) {
            if (putCode == 403) {
                throw new Exception(
                    "Token GitHub sem Contents: Read and write."
                );
            }

            throw new Exception(
                "GitHub PUT HTTP " +
                putCode + ": " + readBody(put)
            );
        }
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
            Cipher.getInstance(
                "AES/GCM/NoPadding"
            );

        cipher.init(
            Cipher.ENCRYPT_MODE,
            new SecretKeySpec(key, "AES"),
            new GCMParameterSpec(128, iv)
        );

        byte[] encrypted =
            cipher.doFinal(
                plain.getBytes(
                    StandardCharsets.UTF_8
                )
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
        boolean active
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

        payload.put(
            "device_hash",
            deviceHash
        );

        payload.put(
            "active",
            active
        );

        try (OutputStream out =
            c.getOutputStream()) {

            out.write(
                payload.toString()
                    .getBytes(StandardCharsets.UTF_8)
            );
        }

        int code =
            c.getResponseCode();

        if (code != 200) {
            String body =
                readBody(c);

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

    private HttpURLConnection openGitHub(
        String url,
        String method,
        String token
    ) throws Exception {

        HttpURLConnection c =
            (HttpURLConnection)
                new URL(url)
                    .openConnection();

        c.setRequestMethod(method);
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);

        c.setRequestProperty(
            "Accept",
            "application/vnd.github+json"
        );

        c.setRequestProperty(
            "Authorization",
            "Bearer " + token
        );

        c.setRequestProperty(
            "X-GitHub-Api-Version",
            "2022-11-28"
        );

        c.setRequestProperty(
            "User-Agent",
            "DarkTV-Admin"
        );

        return c;
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

        while (
            (line = reader.readLine()) != null
        ) {
            out.append(line);
        }

        reader.close();
        return out.toString();
    }

    private String formatDeviceInput(
        String value
    ) {

        String raw =
            value == null
                ? ""
                : value.toUpperCase(
                    Locale.US
                );

        String hex =
            raw.replaceAll(
                "[^0-9A-F]",
                ""
            );

        if (hex.length() > 12) {
            hex =
                hex.substring(0, 12);
        }

        StringBuilder out =
            new StringBuilder();

        for (
            int i = 0;
            i < hex.length();
            i++
        ) {
            if (
                i > 0 &&
                i % 2 == 0
            ) {
                out.append(":");
            }

            out.append(
                hex.charAt(i)
            );
        }

        return out.toString();
    }

    private String normalizeDeviceId(
        String value
    ) {
        return formatDeviceInput(value);
    }

    private String sha256(
        String value
    ) throws Exception {

        MessageDigest digest =
            MessageDigest.getInstance(
                "SHA-256"
            );

        byte[] bytes =
            digest.digest(
                value.getBytes(
                    StandardCharsets.UTF_8
                )
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

    private void fail(String message) {
        status.setText(message);
        status.setTextColor(
            Color.rgb(
                248,
                113,
                113
            )
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
            Color.rgb(
                113,
                113,
                122
            )
        );

        e.setBackgroundColor(
            Color.rgb(
                32,
                32,
                36
            )
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
            Color.rgb(
                229,
                9,
                20
            )
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
