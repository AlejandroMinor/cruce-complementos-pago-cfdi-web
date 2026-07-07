const NS = {
    cfdi:   "http://www.sat.gob.mx/cfd/4",
    tfd:    "http://www.sat.gob.mx/TimbreFiscalDigital",
    pago20: "http://www.sat.gob.mx/Pagos20",
};

const TOLERANCIA = 0.01;

const fmtMoneda = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
}

function getXmlInfo(filename, xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "application/xml");

    if (doc.getElementsByTagName("parsererror").length) {
        return { archivo: filename, error: "XML inválido" };
    }

    const comprobante = doc.documentElement;
    const timbre      = doc.getElementsByTagNameNS(NS.tfd, "TimbreFiscalDigital")[0];

    const info = {
        archivo: filename,
        uuid:    timbre?.getAttribute("UUID")?.toUpperCase() ?? null,
        tipo:    comprobante.getAttribute("TipoDeComprobante"),
        fecha:   comprobante.getAttribute("Fecha"),
        total:   Number(comprobante.getAttribute("Total")),
        pagos:   [],
    };

    if (info.tipo === "P") {
        for (const pago of doc.getElementsByTagNameNS(NS.pago20, "Pago")) {
            const fechaPago = pago.getAttribute("FechaPago");
            for (const docRel of pago.getElementsByTagNameNS(NS.pago20, "DoctoRelacionado")) {
                info.pagos.push({
                    uuid_rel:   docRel.getAttribute("IdDocumento")?.toUpperCase() ?? null,
                    imp_pagado: Number(docRel.getAttribute("ImpPagado")),
                    fecha_pago: fechaPago,
                });
            }
        }
    }

    return info;
}

function indexarFacturas(infos, avisos) {
    const facturas = new Map();
    for (const info of infos) {
        if (info.error) {
            avisos.push(`'${info.archivo}': ${info.error}, se omitió.`);
        } else if (info.tipo !== "I") {
            avisos.push(`'${info.archivo}' no es tipo I (Ingreso), se omitió.`);
        } else if (!info.uuid) {
            avisos.push(`'${info.archivo}' no tiene UUID de timbrado, se omitió.`);
        } else if (facturas.has(info.uuid)) {
            avisos.push(`'${info.archivo}' tiene el mismo UUID que '${facturas.get(info.uuid).archivo}', se omitió.`);
        } else {
            facturas.set(info.uuid, info);
        }
    }
    return facturas;
}

function indexarPagos(infos, avisos) {
    const pagosPorFactura = new Map();
    for (const info of infos) {
        if (info.error) {
            avisos.push(`'${info.archivo}': ${info.error}, se omitió.`);
            continue;
        }
        if (info.tipo !== "P") {
            avisos.push(`'${info.archivo}' no es tipo P (Pago), se omitió.`);
            continue;
        }
        if (!info.pagos.length) {
            avisos.push(`'${info.archivo}' no tiene documentos relacionados, se omitió.`);
            continue;
        }
        for (const p of info.pagos) {
            if (!p.uuid_rel) {
                avisos.push(`'${info.archivo}' tiene un documento relacionado sin IdDocumento, se omitió ese pago.`);
                continue;
            }
            const lista = pagosPorFactura.get(p.uuid_rel) ?? [];
            lista.push({ ...p, archivo: info.archivo });
            pagosPorFactura.set(p.uuid_rel, lista);
        }
    }
    return pagosPorFactura;
}

function leerArchivos(files) {
    return Promise.all([...files].map(file =>
        file.text().then(text => getXmlInfo(file.name, text))
    ));
}

const COLS = [
    { key: "estado",      label: "Estado" },
    { key: "factura",     label: "Factura" },
    { key: "complemento", label: "Complementos" },
    { key: "uuid",        label: "UUID" },
    { key: "ffactura",    label: "Fecha factura" },
    { key: "total",       label: "Total" },
    { key: "fpago",       label: "Fecha pago" },
    { key: "importe",     label: "Importe pagado" },
];

async function cruzar() {
    const resultado = document.getElementById("resultado");
    resultado.innerHTML = "";

    const filesFacturas     = document.getElementById("facturas").files;
    const filesComplementos = document.getElementById("complementos").files;

    if (!filesFacturas.length || !filesComplementos.length) {
        resultado.innerHTML = '<p class="error-msg">Selecciona archivos en ambas zonas.</p>';
        return;
    }

    try {
        const avisos = [];
        const facturas        = indexarFacturas(await leerArchivos(filesFacturas), avisos);
        const pagosPorFactura = indexarPagos(await leerArchivos(filesComplementos), avisos);

        let rows = "";
        let pagadas = 0, parciales = 0;
        for (const [uuid, factura] of facturas) {
            const pagos = pagosPorFactura.get(uuid) ?? [];
            pagosPorFactura.delete(uuid);

            const pagado = pagos.reduce((suma, p) => suma + p.imp_pagado, 0);
            let badge;
            if (!pagos.length) {
                badge = '<span class="badge badge-err">✗ Sin pago</span>';
            } else if (pagado >= factura.total - TOLERANCIA) {
                badge = '<span class="badge badge-ok">✓ Pagada</span>';
                pagadas++;
            } else {
                badge = '<span class="badge badge-warn">◐ Parcial</span>';
                parciales++;
            }

            const archivosPago = [...new Set(pagos.map(p => p.archivo))].map(esc).join(", ");
            const ultimaFechaPago = pagos.map(p => p.fecha_pago).filter(Boolean).sort().at(-1);

            rows += `
                <tr>
                    <td class="col-estado">${badge}</td>
                    <td class="col-factura">${esc(factura.archivo)}</td>
                    <td class="col-complemento ${pagos.length ? "" : "sin-match"}">${archivosPago || "Sin complemento"}</td>
                    <td class="col-uuid uuid" title="${esc(uuid)}">${esc(uuid)}</td>
                    <td class="col-ffactura num">${esc(factura.fecha?.slice(0, 10))}</td>
                    <td class="col-total num">${fmtMoneda.format(factura.total)}</td>
                    <td class="col-fpago num ${ultimaFechaPago ? "" : "sin-match"}">${ultimaFechaPago ? esc(ultimaFechaPago.slice(0, 10)) : "—"}</td>
                    <td class="col-importe num ${pagos.length ? "" : "sin-match"}">${pagos.length ? fmtMoneda.format(pagado) : "—"}</td>
                </tr>`;
        }

        const avisosHtml = avisos.length ? `
            <div class="warnings">
                <strong>Avisos</strong>
                <ul>${avisos.map(a => `<li>${esc(a)}</li>`).join("")}</ul>
            </div>` : "";

        const sinPago = facturas.size - pagadas - parciales;
        const summaryHtml = `
            <div class="summary">
                <span class="pill">${facturas.size} facturas</span>
                <span class="pill pill-ok">✓ ${pagadas} pagadas</span>
                ${parciales ? `<span class="pill pill-warn">◐ ${parciales} parciales</span>` : ""}
                <span class="pill pill-err">✗ ${sinPago} sin pago</span>
            </div>`;

        const togglesHtml = COLS.map(c =>
            `<label>
                <input type="checkbox" checked data-col="${c.key}">
                ${c.label}
            </label>`
        ).join("");

        // Lo que quedó en pagosPorFactura no cruzó con ninguna factura cargada
        let huerfanosHtml = "";
        if (pagosPorFactura.size) {
            let huerfanoRows = "";
            let nHuerfanos = 0;
            for (const [uuid, pagos] of pagosPorFactura) {
                for (const p of pagos) {
                    nHuerfanos++;
                    huerfanoRows += `
                        <tr>
                            <td>${esc(p.archivo)}</td>
                            <td class="uuid" title="${esc(uuid)}">${esc(uuid)}</td>
                            <td class="num">${p.fecha_pago ? esc(p.fecha_pago.slice(0, 10)) : "—"}</td>
                            <td class="num">${fmtMoneda.format(p.imp_pagado)}</td>
                        </tr>`;
                }
            }
            huerfanosHtml = `
                <h2 class="section-label">Complementos sin factura (${nHuerfanos})</h2>
                <div class="table-card">
                    <table>
                        <thead>
                            <tr>
                                <th>Complemento</th>
                                <th>UUID relacionado</th>
                                <th>Fecha pago</th>
                                <th>Importe</th>
                            </tr>
                        </thead>
                        <tbody>${huerfanoRows}</tbody>
                    </table>
                </div>`;
        }

        resultado.innerHTML = `
            ${avisosHtml}
            ${summaryHtml}
            <details id="col-toggles">
                <summary>Columnas visibles</summary>
                <div>${togglesHtml}</div>
            </details>
            <div class="table-card">
                <table id="tabla-resultado">
                    <thead>
                        <tr>${COLS.map(c => `<th class="col-${c.key}">${c.label}</th>`).join("")}</tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${huerfanosHtml}`;

        document.querySelectorAll("#col-toggles input[data-col]").forEach(cb => {
            cb.addEventListener("change", () => {
                document.getElementById("tabla-resultado")
                    .classList.toggle(`hide-${cb.dataset.col}`, !cb.checked);
            });
        });

    } catch (e) {
        resultado.innerHTML = `<p class="error-msg">Error: ${esc(e.message)}</p>`;
    }
}

function setupDropzone(inputId) {
    const input    = document.getElementById(inputId);
    const dropzone = document.querySelector(`label[for="${inputId}"]`);
    const counter  = document.getElementById(`${inputId}-count`);

    const updateCount = () => {
        const n = input.files.length;
        counter.textContent = n === 1 ? "1 archivo" : `${n} archivos`;
        counter.classList.toggle("has-files", n > 0);
    };

    input.addEventListener("change", updateCount);
    dropzone.addEventListener("dragover", e => {
        e.preventDefault();
        dropzone.classList.add("drag-over");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
    dropzone.addEventListener("drop", e => {
        e.preventDefault();
        dropzone.classList.remove("drag-over");
        input.files = e.dataTransfer.files;
        updateCount();
    });
}

setupDropzone("facturas");
setupDropzone("complementos");
document.getElementById("btn-cruzar").addEventListener("click", cruzar);
