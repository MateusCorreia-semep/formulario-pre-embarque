// Cloudflare Pages Function: POST /api/enviar
// Recebe as respostas do formulário e repassa ao fluxo do Power Automate.
// A URL do gatilho HTTP fica na variável secreta FLOW_URL (Pages > Settings > Variables and Secrets),
// assim ela nunca aparece no navegador.
// FORM_SECRET é uma senha enviada no cabeçalho x-form-secret: o fluxo só aceita a chamada se ela bater,
// então a URL vazada sozinha não basta para gravar respostas.

const TAMANHO_MAXIMO = 1024 * 1024; // 1 MB
const CAMPOS_OBRIGATORIOS = ['empresa', 'nome', 'telefone', 'unidade', 'declaracao', 'assinatura'];
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function responder(status, corpo) {
    return new Response(JSON.stringify(corpo), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}

export async function onRequestPost({ request, env }) {
    if (!env.FLOW_URL || !env.FORM_SECRET) {
        console.error('FLOW_URL ou FORM_SECRET não configurada');
        return responder(500, { ok: false, erro: 'Envio não configurado.' });
    }

    // Aceita apenas envios feitos pelo próprio site
    const origem = request.headers.get('Origin');
    if (origem && origem !== new URL(request.url).origin) {
        return responder(403, { ok: false, codigo: 'nao_autorizado', erro: 'Origem não permitida.' });
    }

    if (!request.headers.get('Content-Type')?.includes('application/json')) {
        return responder(415, { ok: false, erro: 'Envie os dados em JSON.' });
    }

    const texto = await request.text();
    if (texto.length > TAMANHO_MAXIMO) {
        return responder(413, { ok: false, erro: 'Dados maiores que o permitido.' });
    }

    let dados;
    try {
        dados = JSON.parse(texto);
    } catch {
        return responder(400, { ok: false, erro: 'JSON inválido.' });
    }

    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
        return responder(400, { ok: false, erro: 'Formato inválido.' });
    }

    const faltando = CAMPOS_OBRIGATORIOS.filter((c) => typeof dados[c] !== 'string' || !dados[c].trim());
    if (faltando.length) {
        return responder(400, { ok: false, erro: `Campos obrigatórios ausentes: ${faltando.join(', ')}` });
    }

    if (!BASE64.test(dados.assinatura)) {
        return responder(400, { ok: false, erro: 'Assinatura inválida.' });
    }

    dados.recebido_em = new Date().toISOString();

    let respostaFluxo;
    try {
        respostaFluxo = await fetch(env.FLOW_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-form-secret': env.FORM_SECRET },
            body: JSON.stringify(dados),
        });
    } catch (erro) {
        console.error('Falha ao chamar o fluxo', erro);
        return responder(502, { ok: false, codigo: 'conexao', erro: 'Não foi possível registrar as respostas.' });
    }

    // 401/403 do fluxo: a senha (FORM_SECRET) não bateu com a configurada na Condição
    if (respostaFluxo.status === 401 || respostaFluxo.status === 403) {
        console.error('Fluxo recusou a chamada', respostaFluxo.status);
        return responder(401, { ok: false, codigo: 'nao_autorizado', erro: 'Envio não autorizado.' });
    }

    if (!respostaFluxo.ok) {
        console.error('Fluxo respondeu com erro', respostaFluxo.status, await respostaFluxo.text());
        return responder(502, { ok: false, codigo: 'fluxo', erro: 'Não foi possível registrar as respostas.' });
    }

    return responder(200, { ok: true });
}

export function onRequest() {
    return responder(405, { ok: false, erro: 'Método não permitido.' });
}
