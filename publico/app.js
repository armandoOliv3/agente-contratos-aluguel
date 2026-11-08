// Tela do agente: envia os PDFs para a API e mostra o relatório
const $ = (seletor) => document.querySelector(seletor)

const form = $('[data-cy="form-envio"]')
const inputArquivos = $('[data-cy="input-arquivos"]')
const inputData = $('[data-cy="input-data-base"]')
const botaoAnalisar = $('[data-cy="botao-analisar"]')
const areaArquivos = $('[data-cy="area-arquivos"]')
const mensagemErro = $('[data-cy="mensagem-erro"]')
const carregando = $('[data-cy="carregando"]')
const resultado = $('[data-cy="resultado"]')

const EXEMPLOS = [
  'ct-2025-001.pdf', 'ct-2024-014.pdf', 'ct-2025-031.pdf', 'ct-2022-007.pdf', 'ct-2024-002.pdf', 'ct-2021-019.pdf',
  'ct-2023-045.pdf', 'ct-2025-050.pdf', 'ct-2025-063.pdf', 'ct-2026-004.pdf', 'ct-2024-030.pdf',
]

let arquivos = []
let analisado = null // { arquivos, dataBase } do último relatório mostrado

const moeda = (v) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '—')
const SITUACOES = { ativo: 'Ativo', encerrado: 'Encerrado', revisar: 'Revisar' }

// Mesma ordem do relatório: revisar, com alertas, sem alertas, encerrados
const PESO = { revisar: 0, ativo: 1, encerrado: 2 }
const ordenar = (contratos) =>
  [...contratos].sort(
    (a, b) =>
      PESO[a.situacao] - PESO[b.situacao] ||
      (b.alertas.length > 0) - (a.alertas.length > 0) ||
      String(a.codigo ?? a.arquivo).localeCompare(String(b.codigo ?? b.arquivo)),
  )

function hojeLocal() {
  const agora = new Date()
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function celula(texto, classe) {
  const td = document.createElement('td')
  td.textContent = texto // textContent: nada que venha do contrato vira HTML
  if (classe) td.className = classe
  return td
}

function mostrarErro(texto) {
  mensagemErro.textContent = texto
  mensagemErro.hidden = !texto
}

function escolherArquivos(lista) {
  arquivos = [...lista]
  $('[data-cy="arquivos-escolhidos"]').textContent = arquivos.length
    ? `${arquivos.length} arquivo(s): ${arquivos.map((a) => a.name).join(', ')}`
    : 'ou arraste os arquivos para cá'
  mostrarErro('')
}

function montarEnvio(lista, dataBase, extras = {}) {
  const dados = new FormData()
  for (const arquivo of lista) dados.append('arquivos', arquivo, arquivo.name)
  dados.append('dataBase', dataBase)
  for (const [k, v] of Object.entries(extras)) dados.append(k, v)
  return dados
}

function mostrarRelatorio(relatorio) {
  const r = relatorio.resumo
  const cartoes = [
    ['Contratos', r.total, 'total'],
    ['Ativos', r.ativos, 'ativos'],
    ['Encerrados', r.encerrados, 'encerrados'],
    ['Para revisar', r.paraRevisar, 'revisar'],
    ['Com alertas', r.comAlertas, 'alertas'],
    ['Receita mensal', moeda(r.receitaMensal), 'receita'],
  ]
  $('[data-cy="resumo"]').replaceChildren(
    ...cartoes.map(([titulo, valor, id]) => {
      const div = document.createElement('div')
      div.className = 'cartao'
      div.dataset.cy = `resumo-${id}`
      div.innerHTML = '<span></span><strong></strong>'
      div.querySelector('span').textContent = titulo
      div.querySelector('strong').textContent = valor
      return div
    }),
  )

  const corpo = $('[data-cy="tabela-contratos"] tbody')
  corpo.replaceChildren(
    ...ordenar(relatorio.contratos).map((l) => {
      const tr = document.createElement('tr')
      tr.className = l.situacao
      tr.dataset.cy = `linha-${l.codigo ?? l.arquivo}`
      const situacao = document.createElement('span')
      situacao.className = `situacao ${l.situacao}`
      situacao.textContent = SITUACOES[l.situacao]
      const tdSituacao = celula('')
      tdSituacao.append(situacao)
      const lista = document.createElement('ul')
      lista.className = 'alertas'
      for (const a of l.alertas) {
        const li = document.createElement('li')
        li.className = a.tipo
        li.dataset.cy = `alerta-${a.tipo}`
        li.textContent = a.mensagem
        lista.append(li)
      }
      const tdAlertas = celula(l.alertas.length ? '' : '—')
      if (l.alertas.length) tdAlertas.append(lista)
      tr.append(
        celula(l.codigo ?? l.arquivo),
        celula(l.locatario ?? '—'),
        celula(l.indice ?? '—'),
        celula(moeda(l.valorContratado), 'num'),
        celula(moeda(l.valorAtual), 'num'),
        celula(dataBR(l.proximoVencimento)),
        celula(dataBR(l.proximoReajuste)),
        celula(dataBR(l.fim)),
        tdSituacao,
        tdAlertas,
      )
      return tr
    }),
  )

  const erros = $('[data-cy="erros-arquivos"]')
  erros.hidden = relatorio.erros.length === 0
  erros.querySelector('ul').replaceChildren(
    ...relatorio.erros.map((e) => {
      const li = document.createElement('li')
      li.textContent = `${e.arquivo}: ${e.mensagem}`
      return li
    }),
  )
  resultado.hidden = false
}

async function analisar() {
  mostrarErro('')
  if (!arquivos.length) return mostrarErro('Escolha pelo menos um contrato em PDF.')
  if (!inputData.value) return mostrarErro('Informe a data base do relatório.')

  botaoAnalisar.disabled = true
  carregando.hidden = false
  try {
    const resposta = await fetch('/api/contratos/analisar', { method: 'POST', body: montarEnvio(arquivos, inputData.value) })
    const corpo = await resposta.json()
    if (!resposta.ok) {
      resultado.hidden = true
      const detalhes = corpo.detalhes?.map((d) => `${d.arquivo}: ${d.mensagem}`).join(' · ')
      return mostrarErro(detalhes ? `${corpo.erro}. ${detalhes}` : corpo.erro)
    }
    analisado = { arquivos, dataBase: inputData.value }
    mostrarRelatorio(corpo)
  } catch {
    mostrarErro('Não foi possível falar com o servidor. Tente de novo.')
  } finally {
    botaoAnalisar.disabled = false
    carregando.hidden = true
  }
}

async function baixar(formato, botao) {
  if (!analisado) return
  botao.disabled = true
  try {
    const resposta = await fetch('/api/contratos/relatorio', {
      method: 'POST',
      body: montarEnvio(analisado.arquivos, analisado.dataBase, { formato }),
    })
    if (!resposta.ok) return mostrarErro((await resposta.json()).erro)
    const nome = /filename="([^"]+)"/.exec(resposta.headers.get('content-disposition') ?? '')?.[1] ?? `relatorio.${formato}`
    const url = URL.createObjectURL(await resposta.blob())
    const link = Object.assign(document.createElement('a'), { href: url, download: nome })
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    mostrarErro('Não foi possível baixar o relatório. Tente de novo.')
  } finally {
    botao.disabled = false
  }
}

async function usarExemplos(evento) {
  evento.preventDefault()
  try {
    const lista = await Promise.all(
      EXEMPLOS.map(async (nome) => new File([await (await fetch(`/exemplos/${nome}`)).blob()], nome, { type: 'application/pdf' })),
    )
    escolherArquivos(lista)
  } catch {
    mostrarErro('Não foi possível carregar os contratos de exemplo.')
  }
}

inputData.value = hojeLocal()
inputArquivos.addEventListener('change', () => escolherArquivos(inputArquivos.files))
form.addEventListener('submit', (e) => {
  e.preventDefault()
  analisar()
})
for (const botao of document.querySelectorAll('[data-formato]')) botao.addEventListener('click', () => baixar(botao.dataset.formato, botao))
$('[data-cy="link-exemplos"]').addEventListener('click', usarExemplos)

areaArquivos.addEventListener('dragover', (e) => {
  e.preventDefault()
  areaArquivos.classList.add('arrastando')
})
areaArquivos.addEventListener('dragleave', () => areaArquivos.classList.remove('arrastando'))
areaArquivos.addEventListener('drop', (e) => {
  e.preventDefault()
  areaArquivos.classList.remove('arrastando')
  escolherArquivos(e.dataTransfer.files)
})

fetch('/api/saude')
  .then((r) => r.json())
  .then((s) => ($('[data-cy="modo-agente"]').textContent = `agente: ${s.agente}`))
  .catch(() => {})
