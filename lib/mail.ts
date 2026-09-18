import fs from 'node:fs'
import path from 'node:path'
import nodemailer from 'nodemailer'

const TEMPLATES_DIR = path.join(process.cwd(), 'templates', 'emails')
const LOGO_PATH = path.join(process.cwd(), 'public', 'Pref.png')
const LOGO_CID = 'logo-prefeitura'

function getTransporter() {
  const host = process.env.MAIL_HOST
  const port = Number(process.env.MAIL_PORT ?? '465')
  const user = process.env.MAIL_USER
  const pass = process.env.MAIL_PASS

  if (!host || !user || !pass) {
    throw new Error('Configuração de e-mail ausente no .env (MAIL_HOST/MAIL_USER/MAIL_PASS).')
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

function readTemplate(name: string) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, `${name}.html`), 'utf-8')
}

function fillTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((html, [key, value]) => html.replaceAll(`{{${key}}}`, value), template)
}

// Monta o e-mail a partir de templates/emails/layout.html (moldura com logo e rodapé)
// e templates/emails/<nome>.html (conteúdo específico daquele e-mail).
function renderEmail(templateName: string, values: Record<string, string>) {
  const content = fillTemplate(readTemplate(templateName), values)
  return fillTemplate(readTemplate('layout'), { ...values, CONTENT: content })
}

export async function sendVerificationCodeEmail(to: string, code: string) {
  const transporter = getTransporter()

  await transporter.sendMail({
    from: `"Portal de Dados Integrados" <${process.env.MAIL_USER}>`,
    to,
    subject: 'Seu código de confirmação do Portal de Dados Integrados',
    text: `Sua conta foi criada com uma senha padrão. Para confirmar seu e-mail e definir sua própria senha, digite este código na tela de troca de senha: ${code}\n\nEste código expira em 1 hora. Se você já trocou sua senha ou não reconhece esta solicitação, pode ignorar esta mensagem.`,
    html: renderEmail('redefinir-senha', { CODE: code }),
    attachments: [
      {
        filename: 'Pref.png',
        path: LOGO_PATH,
        cid: LOGO_CID,
      },
    ],
  })
}
