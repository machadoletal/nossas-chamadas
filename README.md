# Nossas Chamadas

Painel do tempo em chamada durante o intercâmbio.
Site publicado: <https://machadoletal.github.io/nossas-chamadas/>

## Como funciona

Site estático de arquivo único (`index.html`), sem backend. Os dados vêm de uma
planilha do Google, mas o site **não fala com o Google** — um GitHub Action
(`build.mjs` + `.github/workflows/deploy.yml`) lê a planilha a cada ~2h e injeta
os dados dentro do `index.html` publicado. O ID da planilha fica só na variável de
repositório **`SHEET_ID`** (Settings › Secrets and variables › Actions › Variables),
nunca no código nem no HTML servido.

Fluxo: você atualiza a planilha → em até ~2h o Action republica o site com os
números novos (ou rode o workflow na mão em Actions › Deploy › Run workflow).

## Planilha

Colunas: `Data | Início (SP) | Duração (min) | Tipo | Plataforma | Quem ligou | Nota`

- **Data**: `AAAA-MM-DD` ou `DD/MM/AAAA`
- **Tipo**: `Vídeo` ou `Voz`/`Áudio` (o app normaliza)
- Precisa estar acessível ao Action: *Compartilhar › Qualquer pessoa com o link:
  Leitor*, ou publicada na web.
- Google Meet já lançado (horários convertidos de UTC para São Paulo).

## Uso local

O `index.html` do repositório vem sem dados. Para ver números sem publicar, use
**Carregar arquivo** com um `.csv` baixado da planilha ou um backup `.json`
(botão **Backup**). **Datas** ajusta início do intercâmbio e data do reencontro.

## O que mostra

Contagem regressiva até o reencontro (05/12/2026, chegada em NYC), relógios SP/NY
com a diferença de fuso, tempo total, médias por dia/semana, duração média, maior
chamada, sequência de dias seguidos, cobertura de dias, tempo em vídeo x áudio,
gráfico de minutos por dia (com hover) e histórico paginado.
