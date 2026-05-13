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

        let html = "";
        for (const [uuid, factura] of Object.entries(facturas)) {
            const complemento = complementos[uuid];
            if (complemento) {
                html += `
                    <div class="match ok">
                        <p>✓ Factura: <strong>${factura.archivo}</strong>  |  Complemento: <strong>${complemento.archivo}</strong></p>
                        <p>UUID: ${uuid}</p>
                        <p>Fecha factura: ${factura.fecha?.slice(0,10)}  |  Total: $${factura.total}</p>
                        <p>Fecha pago: ${complemento.fecha?.slice(0,10)}  |  Importe pagado: $${complemento.imp_pagado}</p>
                    </div>`;
            } else {
                html += `
                    <div class="match error">
                        <p>✗ Factura: <strong>${factura.archivo}</strong> → SIN complemento de pago</p>
                        <p>UUID: ${uuid}</p>
                    </div>`;
            }
        }
        resultado.innerHTML = html;

    } catch (e) {
        resultado.innerHTML = `<p class="error">Error: ${e.message}</p>`;
    }
}
