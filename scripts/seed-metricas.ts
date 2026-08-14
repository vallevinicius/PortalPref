import path from 'node:path'
import process from 'node:process'

process.loadEnvFile(path.resolve(process.cwd(), '.env'))

import type { RowDataPacket } from 'mysql2'
import { getPool } from '../lib/db'

const METRICAS_POR_SECRETARIA: Record<string, string[]> = {
  'Secretaria Municipal de Educação, Cultura, Inclusão, Ciência e Tecnologia': [
    'Número de alunos',
    'Número de beneficiários do Educa Saquá',
    'Número de unidades de ensino',
    'Números de alunos Escola Viva',
    'Número de alunos Escola Ativa',
    'Números de alunos no COUNI',
    'Número de alunos Escola de Tempo Integral',
    'Número de escolas e creches em obras',
  ],
  'Secretaria Municipal de Saúde': [
    'Número de unidades de saúde',
    'Número de atendimentos realizados',
    'Número de cirurgias do hospital',
    'Número da cobertura em saúde básica',
    'Número de exames de imagens realizados',
  ],
  'Secretaria Municipal de Transporte e Serviços Públicos': [
    'Número de linhas de ônibus',
    'Número de cartões Tarifa Solidária em uso',
    'Número de viagens com o Tarifa Solidária já realizados',
    'Número de praças reformadas',
  ],
  'Secretaria Municipal de Segurança e Ordem Pública': [
    'Número de agentes de segurança na cidade',
    'Números referentes ao PROEIS, Guarda Civil e Segurança Presente',
  ],
  'Secretaria Municipal da Mulher': [
    'Número de mulheres atendidas no CRAM',
    'Número de atendidos no CAPO',
    'Número de mulheres acompanhadas pelos demais setores da secretaria',
  ],
  'Secretaria Municipal de Agricultura, Abastecimento e Pesca': [
    'Número de agricultores beneficiados pela Prefeitura',
    'Quantitativo de alimentos que a Prefeitura compra dos agricultores',
    'Estimativa de empregos gerados pelo agro na cidade',
  ],
  'Secretaria Municipal de Obras Públicas': [
    'Número de obras em andamento, com a evolução de cada',
    'Obras em projeto e/ou licitação',
  ],
  'Secretaria Municipal de Esporte, Lazer e Turismo': [
    'Número de eventos realizados na cidade',
    'Estimativa anual de turistas na cidade',
    'Estimativa de empregos gerados com o turismo',
    'Estimativa de renda gerada pelo turismo na cidade',
  ],
  'Secretaria Municipal de Administração, Receita e Tributação': [
    'Número de funcionários da Prefeitura',
    'Número de empresas cadastradas na cidade',
    'Número de MEIs da cidade',
    'Evolução da arrecadação municipal',
  ],
  'Secretaria Municipal de Desenvolvimento Social': [
    'Número de atendidos no Moeda Saquá',
    'Número de atendidos nos CRAS',
    'Número de atendidos no Centro Dia do Idoso',
    'Número de atendidos nos abrigos',
  ],
  'Secretaria Municipal de Infraestrutura': [
    'Número de obras de pavimentação em andamento, com a evolução de cada',
    'Obras em projeto e/ou licitação',
  ],
  'Secretaria Municipal de Urbanismo': [
    'Número de projetos legalizados',
    'Número de projetos em legalização',
    'Números das equipes de fiscalização',
  ],
  'Secretaria Municipal de Meio Ambiente': [
    'Número de licenças emitidas',
    'Número de licenças em análise',
    'Número de ações de educação ambiental',
  ],
  'Secretaria Municipal dos Direitos dos Animais': [
    'Número de atendidos pelo SaquaPet',
    'Número de pets adotados nas feiras',
    'Número de atendimentos das clínicas veterinárias',
  ],
  'Secretaria Municipal de Finanças': [
    'Número de empenhos emitidos',
    'Receita Executada x Receita Empenhada',
    'Valor Pago x Valor Arrecadado',
  ],
  'Secretaria Municipal de Comunicação Social': [
    'Número de pautas atendidas com a imprensa',
    'Número de inaugurações realizadas',
    'Números da evolução das redes sociais',
  ],
  'IPRES (Instituto de Previdência dos Servidores Municipais de Saquarema)': [
    'Número de aposentados',
    'Número de pensionistas',
    'Número de atendidos pelo cartão viver bem',
  ],
  'Controladoria Geral do Município': [
    'Número de processos analisados',
    'Número de processos em auditoria nos órgãos externos',
    'Número de procedimentos realizados para adequação',
  ],
  'Procuradoria Geral do Município': [
    'Número de processos analisados',
    'Número de processos em juízo',
    'Número de precatórios',
  ],
  'Secretaria Municipal de Gestão, Inovação e Tecnologia': [
    'Número de processos em licitação',
    'Número de contratos ativos',
    'Número de contratos próximos ao encerramento',
    'Atualizações do PCA',
  ],
  'Secretaria Municipal de Governança e Sustentabilidade': [
    'Número de projetos em andamento',
    'Número de projetos finalizados',
  ],
  'Secretaria Municipal de Planejamento': [
    'Número de reservas emitidas',
    'Orçamento Executada x Receita Planejado',
    'Perspectivas de Arrecadação para os próximos meses',
  ],
  'Secretaria Municipal de Relações Institucionais': ['Projetos em andamento'],
  'Secretaria Municipal de Transparência e Integridade': [
    'Números da Ouvidoria',
    'Números de processos em análise na secretaria',
    'Números de processos em análise dos órgãos externos',
  ],
  'Secretaria Municipal de Habitação': ['Projetos em andamento'],
}

interface SecretariaRow extends RowDataPacket {
  id: number
  nome: string
}

async function main() {
  const pool = getPool()

  const [secretarias] = await pool.query<SecretariaRow[]>('SELECT id, nome FROM secretarias')
  const idByNome = new Map(secretarias.map((s) => [s.nome, s.id]))

  let created = 0
  let missing = 0

  for (const [nomeSecretaria, metricas] of Object.entries(METRICAS_POR_SECRETARIA)) {
    const secretariaId = idByNome.get(nomeSecretaria)
    if (!secretariaId) {
      console.warn(`Secretaria não encontrada, pulando: "${nomeSecretaria}"`)
      missing += metricas.length
      continue
    }

    for (const metrica of metricas) {
      const [result] = await pool.query('INSERT IGNORE INTO projetos (secretaria_id, nome) VALUES (?, ?)', [
        secretariaId,
        metrica,
      ])
      if ((result as { affectedRows: number }).affectedRows > 0) created += 1
    }
  }

  console.log(`${created} indicador(es) novo(s) cadastrado(s). ${missing} pulado(s) por secretaria não encontrada.`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
