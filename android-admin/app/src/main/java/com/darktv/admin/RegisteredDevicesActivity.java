package com.darktv.admin;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
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
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

public class RegisteredDevicesActivity extends Activity {

    private static final String REGISTERED_URL =
        "https://mabdjbzjgsjxbdhrkvmb.supabase.co/functions/v1/admin-devices";

    private LinearLayout list;
    private TextView status;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.rgb(9, 9, 11));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(24), dp(20), dp(36));
        scroll.addView(root);

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);

        Button back = smallButton("‹");
        back.setOnClickListener(v -> finish());
        header.addView(back);

        TextView title = text("MACs registrados", 25, true);
        LinearLayout.LayoutParams titleParams =
            new LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
            );
        titleParams.leftMargin = dp(12);
        title.setLayoutParams(titleParams);
        header.addView(title);

        Button refresh = smallButton("↻");
        refresh.setOnClickListener(v -> loadDevices());
        header.addView(refresh);

        root.addView(header);

        TextView help = text(
            "Somente aparelhos com pagamento confirmado aparecem aqui. Toque em um MAC / ID para voltar e preencher o formulário de liberação.",
            13,
            false
        );
        help.setTextColor(Color.LTGRAY);
        help.setPadding(0, dp(14), 0, dp(16));
        root.addView(help);

        status = text("Carregando...", 14, true);
        status.setTextColor(Color.rgb(250, 204, 21));
        status.setPadding(0, 0, 0, dp(14));
        root.addView(status);

        list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        root.addView(list);

        setContentView(scroll);
        loadDevices();
    }

    private void loadDevices() {
        final String adminKey =
            getSharedPreferences("admin", MODE_PRIVATE)
                .getString("darktv_admin_key", "")
                .trim();

        list.removeAllViews();

        if (adminKey.isEmpty()) {
            status.setText(
                "Salve a Chave Admin na tela principal antes de abrir os MACs."
            );
            status.setTextColor(
                Color.rgb(248, 113, 113)
            );
            return;
        }

        status.setText("Buscando pagamentos confirmados...");
        status.setTextColor(Color.rgb(250, 204, 21));

        new Thread(() -> {
            try {
                HttpURLConnection c =
                    (HttpURLConnection)
                        new URL(REGISTERED_URL)
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

                JSONObject payload = new JSONObject();
                payload.put("limit", 100);

                try (OutputStream out = c.getOutputStream()) {
                    out.write(
                        payload.toString()
                            .getBytes(StandardCharsets.UTF_8)
                    );
                }

                int code = c.getResponseCode();
                String body = readBody(c);

                if (code == 401) {
                    throw new Exception(
                        "Chave Admin inválida."
                    );
                }

                if (code != 200) {
                    throw new Exception(
                        "Backend HTTP " +
                        code +
                        ": " +
                        body
                    );
                }

                JSONObject response =
                    new JSONObject(body);

                JSONArray devices =
                    response.optJSONArray("devices");

                runOnUiThread(() ->
                    renderDevices(devices)
                );

            } catch (Exception e) {
                runOnUiThread(() -> {
                    status.setText(
                        "Erro: " + e.getMessage()
                    );
                    status.setTextColor(
                        Color.rgb(248, 113, 113)
                    );
                });
            }
        }).start();
    }

    private void renderDevices(JSONArray devices) {
        list.removeAllViews();

        int count =
            devices == null
                ? 0
                : devices.length();

        if (count == 0) {
            status.setText(
                "Nenhum aparelho com pagamento confirmado."
            );
            status.setTextColor(Color.LTGRAY);
            return;
        }

        status.setText(
            count +
            (count == 1
                ? " aparelho pago"
                : " aparelhos pagos")
        );
        status.setTextColor(
            Color.rgb(134, 239, 172)
        );

        for (int i = 0; i < count; i++) {
            JSONObject row =
                devices.optJSONObject(i);

            if (row == null) continue;

            String deviceId =
                row.optString(
                    "device_id",
                    ""
                );

            if (deviceId.isEmpty()) {
                continue;
            }

            LinearLayout card =
                new LinearLayout(this);

            card.setOrientation(
                LinearLayout.VERTICAL
            );

            card.setPadding(
                dp(16),
                dp(14),
                dp(16),
                dp(14)
            );

            card.setBackgroundColor(
                Color.rgb(28, 28, 32)
            );

            LinearLayout.LayoutParams cardParams =
                new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                );

            cardParams.bottomMargin = dp(12);
            card.setLayoutParams(cardParams);

            TextView mac =
                text(deviceId, 21, true);

            mac.setTextColor(Color.WHITE);
            card.addView(mac);

            String provider =
                row.optString(
                    "provider",
                    "asaas"
                );

            String paymentStatus =
                row.optString(
                    "payment_status",
                    "PAID"
                );

            TextView payment =
                text(
                    "Pagamento: " +
                    paymentStatus +
                    " · " +
                    provider.toUpperCase(Locale.US),
                    13,
                    true
                );

            payment.setTextColor(
                Color.rgb(134, 239, 172)
            );
            payment.setPadding(
                0,
                dp(6),
                0,
                0
            );
            card.addView(payment);

            addInfo(
                card,
                "Pago em",
                formatIso(
                    row.optString(
                        "paid_at",
                        ""
                    )
                )
            );

            addInfo(
                card,
                "Acesso até",
                formatIso(
                    row.optString(
                        "access_expires_at",
                        ""
                    )
                )
            );

            String lastEvent =
                row.optString(
                    "last_event",
                    ""
                );

            if (!lastEvent.isEmpty()) {
                addInfo(
                    card,
                    "Último evento",
                    prettyEvent(lastEvent)
                );

                addInfo(
                    card,
                    "Evento em",
                    formatIso(
                        row.optString(
                            "last_event_at",
                            ""
                        )
                    )
                );
            }

            JSONArray logs =
                row.optJSONArray("logs");

            if (
                logs != null &&
                logs.length() > 0
            ) {
                TextView logTitle =
                    text(
                        "Logs recentes",
                        13,
                        true
                    );

                logTitle.setTextColor(
                    Color.rgb(161, 161, 170)
                );

                logTitle.setPadding(
                    0,
                    dp(10),
                    0,
                    dp(3)
                );

                card.addView(logTitle);

                int max =
                    Math.min(
                        4,
                        logs.length()
                    );

                for (int l = 0; l < max; l++) {
                    JSONObject log =
                        logs.optJSONObject(l);

                    if (log == null) continue;

                    String event =
                        prettyEvent(
                            log.optString(
                                "event_type",
                                ""
                            )
                        );

                    String when =
                        formatIso(
                            log.optString(
                                "event_at",
                                ""
                            )
                        );

                    TextView line =
                        text(
                            "• " +
                            when +
                            " — " +
                            event,
                            12,
                            false
                        );

                    line.setTextColor(
                        Color.rgb(212, 212, 216)
                    );

                    card.addView(line);
                }
            }

            TextView tap =
                text(
                    "TOCAR PARA USAR ESTE MAC / ID",
                    12,
                    true
                );

            tap.setTextColor(
                Color.rgb(250, 204, 21)
            );

            tap.setPadding(
                0,
                dp(12),
                0,
                0
            );

            card.addView(tap);

            card.setClickable(true);
            card.setFocusable(true);

            card.setOnClickListener(v -> {
                Intent data = new Intent();

                data.putExtra(
                    "selected_device_id",
                    deviceId
                );

                setResult(
                    RESULT_OK,
                    data
                );

                finish();
            });

            list.addView(card);
        }
    }

    private void addInfo(
        LinearLayout card,
        String label,
        String value
    ) {
        TextView line =
            text(
                label + ": " + value,
                13,
                false
            );

        line.setTextColor(
            Color.rgb(212, 212, 216)
        );

        line.setPadding(
            0,
            dp(5),
            0,
            0
        );

        card.addView(line);
    }

    private String prettyEvent(String value) {
        if (value == null) return "—";

        String v =
            value.trim()
                .replace("_", " ");

        if (v.isEmpty()) return "—";

        return v;
    }

    private String formatIso(String value) {
        if (
            value == null ||
            value.trim().isEmpty() ||
            "null".equalsIgnoreCase(
                value.trim()
            )
        ) {
            return "—";
        }

        String[] patterns =
            new String[] {
                "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
                "yyyy-MM-dd'T'HH:mm:ssXXX",
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                "yyyy-MM-dd'T'HH:mm:ss'Z'"
            };

        for (String pattern : patterns) {
            try {
                SimpleDateFormat parser =
                    new SimpleDateFormat(
                        pattern,
                        Locale.US
                    );

                if (pattern.endsWith("'Z'")) {
                    parser.setTimeZone(
                        TimeZone.getTimeZone("UTC")
                    );
                }

                Date date =
                    parser.parse(value);

                if (date != null) {
                    SimpleDateFormat output =
                        new SimpleDateFormat(
                            "dd/MM/yyyy HH:mm",
                            Locale.getDefault()
                        );

                    return output.format(date);
                }
            } catch (Exception ignored) {}
        }

        String fallback =
            value.replace(
                "T",
                " "
            );

        if (fallback.length() > 16) {
            fallback =
                fallback.substring(0, 16);
        }

        return fallback;
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

    private Button smallButton(String label) {
        Button b = new Button(this);

        b.setText(label);
        b.setTextSize(24);
        b.setTextColor(Color.WHITE);
        b.setBackgroundColor(
            Color.rgb(32, 32, 36)
        );

        LinearLayout.LayoutParams p =
            new LinearLayout.LayoutParams(
                dp(54),
                dp(50)
            );

        b.setLayoutParams(p);
        return b;
    }

    private TextView text(
        String value,
        int sp,
        boolean bold
    ) {
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

    private int dp(int value) {
        return (int) (
            value *
            getResources()
                .getDisplayMetrics()
                .density
        );
    }
}
