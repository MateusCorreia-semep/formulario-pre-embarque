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
            abrirSecao(null);
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

form.addEventListener('submit', (e) => {
    e.preventDefault();

    const invalida = secoes.find((s) => !validarSecao(s, { mostrarErros: false }));
    if (invalida) {
        invalida.classList.remove('secao--concluida');
        abrirSecao(invalida);
        atualizarEstado();
        rolarAte(invalida);
        setTimeout(() => validarSecao(invalida), DURACAO_ANIMACAO);
        return;
    }

    // Grupos de checkbox sempre viram listas, mesmo com uma única opção marcada
    const dados = {};
    for (const [campo, valor] of new FormData(form)) {
        const multiplo = form.querySelectorAll(`input[type="checkbox"][name="${campo}"]`).length > 1;
        if (multiplo) (dados[campo] ??= []).push(valor);
        else dados[campo] = valor;
    }
    // Envio ainda não implementado: por enquanto apenas exibe os dados no console
    console.log(dados);
});

atualizarCondicionais();
atualizarEstado();
