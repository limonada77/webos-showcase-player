import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StreamTV — App IPTV Xtream para LG webOS" },
      {
        name: "description",
        content:
          "StreamTV: app IPTV para LG webOS com login Xtream Codes, interface de streaming e player HLS. Baixe o .ipk pronto para instalar.",
      },
      { property: "og:title", content: "StreamTV — App IPTV Xtream para LG webOS" },
      {
        property: "og:description",
        content:
          "Interface estilo streaming, navegação por controle remoto e player HLS. Pacote .ipk pronto para a sua LG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Stream<span className="text-destructive">TV</span> — app IPTV para LG webOS
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Login exclusivo por Xtream Codes, catálogo de filmes, séries e canais ao vivo, player HLS
          e navegação completa pelo controle remoto. Prévia abaixo (use as setas do teclado e Enter).
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/downloads/com.streamtv.app_1.0.0_all.ipk"
            className="inline-flex h-11 items-center rounded-md bg-destructive px-5 text-sm font-semibold text-destructive-foreground"
          >
            Baixar .ipk (v1.0.0)
          </a>
          <a
            href="/tv/index.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center rounded-md border border-border px-5 text-sm font-semibold"
          >
            Abrir app em tela cheia
          </a>
        </div>

        <div className="mt-8 overflow-hidden rounded-lg border border-border bg-black">
          <iframe
            title="Prévia do StreamTV"
            src="/tv/index.html"
            className="h-[720px] w-full"
            style={{ border: 0 }}
          />
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-border p-5">
            <h2 className="text-lg font-bold">Como instalar na TV</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Na TV, instale o Developer Mode App (LG Content Store) e ative o Dev Mode.</li>
              <li>
                No PC: <code>npm i -g @webos-tools/cli</code> e depois{" "}
                <code>ares-setup-device</code> apontando para o IP da TV.
              </li>
              <li>
                <code>ares-install com.streamtv.app_1.0.0_all.ipk -d minhaTV</code>
              </li>
              <li>Abra o StreamTV na tela inicial e entre com servidor, usuário e senha Xtream.</li>
            </ol>
          </div>
          <div className="rounded-lg border border-border p-5">
            <h2 className="text-lg font-bold">Controles do remoto</h2>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              <li>Setas: navegar · OK: selecionar/pausar</li>
              <li>Voltar: tela anterior / sair do player</li>
              <li>◀ ▶ no player: retroceder e avançar 10s</li>
              <li>Play/Pause/Stop do controle também funcionam</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
