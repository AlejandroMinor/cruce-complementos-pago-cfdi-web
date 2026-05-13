const NS = {
    cfdi:   "http://www.sat.gob.mx/cfd/4",
    tfd:    "http://www.sat.gob.mx/TimbreFiscalDigital",
    pago20: "http://www.sat.gob.mx/Pagos20",
};

function getNode(doc, tag, ns) {
    return doc.getElementsByTagNameNS(ns, tag)[0] || null;
}

function getXmlInfo(filename, xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "application/xml");

    const comprobante = doc.documentElement;
    const timbre      = getNode(doc, "TimbreFiscalDigital", NS.tfd);

    const info = {
        archivo: filename,
        uuid:    timbre?.getAttribute("UUID")?.toUpperCase() ?? null,
        tipo:    comprobante.getAttribute("TipoDeComprobante"),
        fecha:   comprobante.getAttribute("Fecha"),
        total:   comprobante.getAttribute("Total"),
        doc_relacionado: null,
        imp_pagado:      null,
    };

    if (info.tipo === "P") {
        const doc_rel = getNode(doc, "DoctoRelacionado", NS.pago20);
        if (doc_rel) {
            info.doc_relacionado = doc_rel.getAttribute("IdDocumento")?.toUpperCase() ?? null;
            info.imp_pagado      = doc_rel.getAttribute("ImpPagado");
        }
    }

    return info;
}

function buildIndex(infos, tipo) {
    const index = {};
    for (const info of infos) {
        if (info.tipo !== tipo) {
            throw new Error(`'${info.archivo}' no es de tipo '${tipo}'.`);
        }
        const clave = tipo === "I" ? info.uuid : info.doc_relacionado;
        index[clave] = info;
    }
    return index;
}

function leerArchivos(files) {
    return Promise.all([...files].map(file =>
        file.text().then(text => getXmlInfo(file.name, text))
    ));
}

async function cruzar() {
    const resultado = document.getElementById("resultado");
    resultado.innerHTML = "";

    const filesFacturas     = document.getElementById("facturas").files;
    const filesComplementos = document.getElementById("complementos").files;

    if (!filesFacturas.length || !filesComplementos.length) {
        resultado.innerHTML = '<p class="error">Selecciona archivos en ambas zonas.</p>';
        return;
    }

    try {
        const infoFacturas     = await leerArchivos(filesFacturas);
        const infoComplementos = await leerArchivos(filesComplementos);

        const facturas     = buildIndex(infoFacturas, "I");
        const complementos = buildIndex(infoComplementos, "P");

        const COLS = [
            { idx: 1, label: "Estado" },
            { idx: 2, label: "Factura" },
            { idx: 3, label: "Complemento" },
            { idx: 4, label: "UUID" },
            { idx: 5, label: "Fecha factura" },
            { idx: 6, label: "Total" },
            { idx: 7, label: "Fecha pago" },
            { idx: 8, label: "Importe pagado" },
        ];

        let rows = "";
        for (const [uuid, factura] of Object.entries(facturas)) {
            const complemento = complementos[uuid];
            if (complemento) {
                rows += `
                    <tr class="row-ok">
                        <td class="estado-ok">✓</td>
                        <td>${factura.archivo}</td>
                        <td>${complemento.archivo}</td>
                        <td class="uuid" >${uuid}</td>
                        <td>${factura.fecha?.slice(0,10)}</td>
                        <td>$${factura.total}</td>
                        <td>${complemento.fecha?.slice(0,10)}</td>
                        <td>$${complemento.imp_pagado}</td>
                    </tr>`;
            } else {
                rows += `
                    <tr class="row-error">
                        <td class="estado-error">✗</td>
                        <td>${factura.archivo}</td>
                        <td class="sin-match">Sin complemento</td>
                        <td class="uuid" >${uuid}</td>
                        <td>${factura.fecha?.slice(0,10)}</td>
                        <td>$${factura.total}</td>
                        <td class="sin-match">—</td>
                        <td class="sin-match">—</td>
                    </tr>`;
            }
        }
        const togglesHtml = COLS.map(c =>
            `<label>
                <input type="checkbox" checked data-col="${c.idx}">
                ${c.label}
            </label>`
        ).join("");

        resultado.innerHTML = `
            <details id="col-toggles" open>
                <summary>Columnas visibles</summary>
                <div>${togglesHtml}</div>
            </details>
            <figure>
                <table id="tabla-resultado">
                    <thead>
                        <tr>
                            <th></th>
                            <th>Factura</th>
                            <th>Complemento</th>
                            <th>UUID</th>
                            <th>Fecha factura</th>
                            <th>Total</th>
                            <th>Fecha pago</th>
                            <th>Importe pagado</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </figure>`;

        document.querySelectorAll("#col-toggles input[data-col]").forEach(cb => {
            cb.addEventListener("change", () => {
                document.getElementById("tabla-resultado")
                    .classList.toggle(`hide-col-${cb.dataset.col}`, !cb.checked);
            });
        });

    } catch (e) {
        resultado.innerHTML = `<p class="error">Error: ${e.message}</p>`;
    }
}
