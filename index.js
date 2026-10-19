const telaInicial = document.getElementById('tela-inicial');
const telaFormulario = document.getElementById('tela-formulario');
const form = document.getElementById('form-pre-embarque');
const telefone = document.getElementById('telefone');

document.getElementById('btn-iniciar').addEventListener('click', () => {
    telaInicial.hidden = true;
    telaFormulario.hidden = false;
    window.scrollTo(0, 0);
    form.querySelector('input').focus();
});

// Máscara (00) 00000-0000
telefone.addEventListener('input', () => {
    const d = telefone.value.replace(/\D/g, '').slice(0, 11);
    let v = d;
    if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) v = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    telefone.value = v;
});

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(form));
    // Envio ainda não implementado: por enquanto apenas exibe os dados no console
    console.log(dados);
});