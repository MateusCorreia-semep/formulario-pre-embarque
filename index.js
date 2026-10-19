const telaInicial = document.getElementById('tela-inicial');
const telaFormulario = document.getElementById('tela-formulario');
const form = document.getElementById('form-pre-embarque');
const telefone = document.getElementById('telefone');
const secoes = [...form.querySelectorAll('[data-secao]')];
const condicionais = [...form.querySelectorAll('.condicional')];
const progresso = document.querySelector('.progresso');
const barraProgresso = document.querySelector('.progresso__barra');

const DURACAO_ANIMACAO = 450;

document.getElementById('btn-iniciar').addEventListener('click', () => {
    telaInicial.hidden = true;
    telaFormulario.hidden = false;
    window.scrollTo(0, 0);
    abrirSecao(secoes[0]);
    atualizarEstado();
});

// Máscara (00) 00000-0000
telefone.addEventListener('input', () => {
    const d = telefone.value.replace(/\D/g, '').slice(0, 11);
    let v = d;
    if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) v = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    telefone.value = v;
});

// ---------- Campos condicionais ----------
// data-condicao="campo=valor": o bloco só aparece quando o campo tiver aquele valor.
// Campos ocultos ficam desabilitados, assim não são validados nem enviados.

function atualizarCondicionais() {
    condicionais.forEach((bloco) => {
        const [campo, valor] = bloco.dataset.condicao.split('=');
        const visivel = [...form.querySelectorAll(`[name="${campo}"]`)].some((el) =>
            el.type === 'radio' || el.type === 'checkbox' ? el.checked && el.value === valor : el.value === valor);
        bloco.classList.toggle('condicional--visivel', visivel);
        bloco.querySelectorAll('input, textarea, select').forEach((el) => {
            el.disabled = !visivel;
        });
    });
}

// ---------- Grupos de checkbox ----------
// data-grupo-obrigatorio: exige ao menos uma opção marcada.
// data-exclusivo: opção que desmarca as demais (ex.: "Não sinto dor nenhuma").

const gruposObrigatorios = [...form.querySelectorAll('[data-grupo-obrigatorio]')];

function atualizarGrupos() {
    gruposObrigatorios.forEach((grupo) => {
        const opcoes = [...grupo.querySelectorAll(':scope > .opcoes > .opcao input[type="checkbox"]')];
        const algumaMarcada = opcoes.some((el) => el.checked);
        opcoes[0].setCustomValidity(algumaMarcada ? '' : 'Selecione pelo menos uma opção.');
    });
}

function aplicarExclusivo(alterado) {
    if (alterado.type !== 'checkbox' || !alterado.checked) return;
    const irmaos = [...form.querySelectorAll(`input[type="checkbox"][name="${alterado.name}"]`)];
    irmaos.forEach((el) => {
        if (el !== alterado && (alterado.hasAttribute('data-exclusivo') || el.hasAttribute('data-exclusivo'))) {
            el.checked = false;
        }
    });
}

// ---------- Seções ----------

const estaConcluida = (secao) => secao.classList.contains('secao--concluida');
const primeiraPendente = () => secoes.find((s) => !estaConcluida(s));

function camposDa(secao) {
    return [...secao.querySelectorAll('input, textarea, select')].filter((el) => !el.disabled);
}

function marcarInvalido(campo, invalido) {
    campo.closest('.pergunta')?.classList.toggle('pergunta--invalida', invalido);
}

function validarSecao(secao, { mostrarErros = true } = {}) {
    atualizarGrupos();
    const campos = camposDa(secao);
    const invalidos = campos.filter((el) => !el.checkValidity());
    if (mostrarErros) {
        // Uma pergunta pode ter vários inputs: fica inválida se qualquer um deles for inválido
        const perguntasInvalidas = new Set(invalidos.map((el) => el.closest('.pergunta')));
        campos.forEach((el) => marcarInvalido(el, perguntasInvalidas.has(el.closest('.pergunta'))));
        if (invalidos.length) invalidos[0].reportValidity();
    }
    return invalidos.length === 0;
}

function abrirSecao(secao) {
    secoes.forEach((s) => {
        const aberta = s === secao;
        s.classList.toggle('secao--aberta', aberta);
        s.querySelector('.secao__cabecalho').setAttribute('aria-expanded', aberta);
    });
}

function rolarAte(secao) {
    // Espera a animação de recolher terminar para rolar até a posição final
    // descontando a altura do topo fixo
    setTimeout(() => {
        const topo = document.querySelector('.topo').offsetHeight;
        const y = secao.getBoundingClientRect().top + window.scrollY - topo - 12;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }, DURACAO_ANIMACAO);
}

function atualizarEstado() {
    const pendente = primeiraPendente();
    const concluidas = secoes.filter(estaConcluida).length;

    secoes.forEach((s, i) => {
        const concluida = estaConcluida(s);
        const liberada = concluida || s === pendente;
        s.querySelector('.secao__cabecalho').disabled = !liberada;
        s.querySelector('.secao__status').textContent = concluida ? 'Respondido' : '';
        s.querySelector('.btn-avancar').textContent = i === secoes.length - 1 ? 'Enviar' : 'Avançar';
    });

    const pct = Math.round((concluidas / secoes.length) * 100);
    barraProgresso.style.width = `${pct}%`;
    progresso.setAttribute('aria-valuenow', pct);
}

secoes.forEach((secao) => {
    secao.querySelector('.secao__cabecalho').addEventListener('click', () => {
        const aberta = secao.classList.contains('secao--aberta');
        abrirSecao(aberta ? null : secao);
        atualizarEstado();
    });

    secao.querySelector('.btn-avancar').addEventListener('click', () => {
        if (!validarSecao(secao)) return;

        secao.classList.add('secao--concluida');
        const proxima = primeiraPendente();

        if (!proxima) {
            atualizarEstado();
            form.requestSubmit();
            return;
        }

        abrirSecao(proxima);
        atualizarEstado();
        rolarAte(proxima);
    });
});

form.addEventListener('input', (e) => marcarInvalido(e.target, false));

form.addEventListener('change', (e) => {
    aplicarExclusivo(e.target);
    atualizarCondicionais();
    atualizarGrupos();
    marcarInvalido(e.target, false);

    // Se uma seção já concluída foi alterada e ficou incompleta, ela volta a ficar pendente
    const secao = e.target.closest('[data-secao]');
    if (estaConcluida(secao) && !validarSecao(secao, { mostrarErros: false })) {
        secao.classList.remove('secao--concluida');
    }
    atualizarEstado();
});

// ---------- Assinatura ----------
// Os traços são guardados em coordenadas relativas (0 a 1) para redesenhar sem distorção
// quando o quadro muda de tamanho (ex.: girar o celular ou abrir a seção).

const canvasAssinatura = form.querySelector('.assinatura__canvas');
const campoAssinatura = form.elements.assinatura;
const ctxAssinatura = canvasAssinatura.getContext('2d');
let tracos = [];
let tracoAtual = null;

function ajustarCanvas() {
    const { width, height } = canvasAssinatura.getBoundingClientRect();
    if (!width || !height) return;
    const dpr = window.devicePixelRatio || 1;
    canvasAssinatura.width = Math.round(width * dpr);
    canvasAssinatura.height = Math.round(height * dpr);
    redesenharAssinatura();
}

function redesenharAssinatura() {
    const { width, height } = canvasAssinatura;
    const dpr = window.devicePixelRatio || 1;
    ctxAssinatura.fillStyle = '#FFFFFF';
    ctxAssinatura.fillRect(0, 0, width, height);
    ctxAssinatura.lineWidth = 2.5 * dpr;
    ctxAssinatura.lineCap = 'round';
    ctxAssinatura.lineJoin = 'round';
    ctxAssinatura.strokeStyle = '#1f2a2a';
    tracos.forEach((traco) => {
        ctxAssinatura.beginPath();
        traco.forEach(([x, y], i) => {
            const px = x * width;
            const py = y * height;
            if (i === 0) ctxAssinatura.moveTo(px, py);
            else ctxAssinatura.lineTo(px, py);
        });
        // Um toque sem movimento vira um ponto
        if (traco.length === 1) ctxAssinatura.lineTo(traco[0][0] * width + 0.1, traco[0][1] * height);
        ctxAssinatura.stroke();
    });
}

function pontoDo(evento) {
    const r = canvasAssinatura.getBoundingClientRect();
    return [(evento.clientX - r.left) / r.width, (evento.clientY - r.top) / r.height];
}

function salvarAssinatura() {
    campoAssinatura.value = tracos.length ? canvasAssinatura.toDataURL('image/png') : '';
    campoAssinatura.dispatchEvent(new Event('change', { bubbles: true }));
}

canvasAssinatura.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvasAssinatura.setPointerCapture(e.pointerId);
    tracoAtual = [pontoDo(e)];
    tracos.push(tracoAtual);
    redesenharAssinatura();
});

canvasAssinatura.addEventListener('pointermove', (e) => {
    if (!tracoAtual) return;
    tracoAtual.push(pontoDo(e));
    redesenharAssinatura();
});

['pointerup', 'pointercancel'].forEach((tipo) => {
    canvasAssinatura.addEventListener(tipo, () => {
        if (!tracoAtual) return;
        tracoAtual = null;
        salvarAssinatura();
    });
});

form.querySelector('.assinatura__limpar').addEventListener('click', () => {
    tracos = [];
    redesenharAssinatura();
    salvarAssinatura();
});

new ResizeObserver(ajustarCanvas).observe(canvasAssinatura);

// ---------- Envio ----------

const avisoEnvio = document.querySelector('.aviso-envio');
const btnEnviar = secoes.at(-1).querySelector('.btn-avancar');

document.querySelector('.aviso-envio__tentar').addEventListener('click', () => form.requestSubmit());

function coletarDados() {
    // Grupos de checkbox sempre viram listas, mesmo com uma única opção marcada
    const dados = {};
    for (const [campo, valor] of new FormData(form)) {
        const multiplo = form.querySelectorAll(`input[type="checkbox"][name="${campo}"]`).length > 1;
        if (multiplo) (dados[campo] ??= []).push(valor);
        else dados[campo] = valor;
    }
    // Só o conteúdo base64 do PNG, pronto para base64ToBinary() no Power Automate
    dados.assinatura = dados.assinatura.replace(/^data:image\/png;base64,/, '');
    dados.enviado_em = new Date().toISOString();
    return dados;
}

function mostrarSucesso() {
    document.querySelector('.conteudo-form').hidden = true;
    const nome = form.elements.nome.value.trim().split(/\s+/)[0];
    document.querySelector('.sucesso__nome').textContent = nome ? `, ${nome}` : '';
    document.getElementById('tela-sucesso').hidden = false;
    window.scrollTo(0, 0);
}

let enviando = false;

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enviando) return;

    const invalida = secoes.find((s) => !validarSecao(s, { mostrarErros: false }));
    if (invalida) {
        invalida.classList.remove('secao--concluida');
        abrirSecao(invalida);
        atualizarEstado();
        rolarAte(invalida);
        setTimeout(() => validarSecao(invalida), DURACAO_ANIMACAO);
        return;
    }

    enviando = true;
    avisoEnvio.hidden = true;
    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando...';

    try {
        const resposta = await fetch('/api/enviar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(coletarDados()),
        });
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        mostrarSucesso();
    } catch (erro) {
        console.error('Falha no envio', erro);
        avisoEnvio.querySelector('.aviso-envio__texto').textContent =
            'Não foi possível enviar suas respostas. Verifique sua conexão e tente novamente.';
        avisoEnvio.hidden = false;
        avisoEnvio.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally {
        enviando = false;
        btnEnviar.disabled = false;
        atualizarEstado();
    }
});

atualizarCondicionais();
atualizarEstado();
