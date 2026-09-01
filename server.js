// ============================================================
// AI ASSISTANT GOLD JOURNAL
// server.js
// GOOGLE SHEETS + IMGBB VERSION
// DATE SEPARATOR VERSION
// ============================================================

const express = require("express");
const path = require("path");
const https = require("https");
const { google } = require("googleapis");

// ============================================================
// APP CONFIG
// ============================================================

const app = express();

const PORT = process.env.PORT || 3000;

const ROOT_DIR = __dirname;
const PUBLIC_DIR = ROOT_DIR;

// ============================================================
// GOOGLE SHEETS CONFIG
// ============================================================

const GOOGLE_SHEET_ID =
    process.env.GOOGLE_SHEET_ID;

const GOOGLE_CLIENT_EMAIL =
    process.env.GOOGLE_CLIENT_EMAIL;

const GOOGLE_PRIVATE_KEY =
    process.env.GOOGLE_PRIVATE_KEY
        ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
        : null;

const SHEET_NAME = "JOURNAL";

// ============================================================
// IMGBB CONFIG
// ============================================================

const IMGBB_API_KEY =
    process.env.IMGBB_API_KEY;

// ============================================================
// ADMIN PASSWORD
// ============================================================

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "Bira1234_";

// ============================================================
// GOOGLE SHEETS CLIENT
// ============================================================

let sheets = null;

// ============================================================
// GOOGLE SHEETS INITIALIZATION
// ============================================================

function initializeGoogleSheets() {

    if (
        !GOOGLE_SHEET_ID ||
        !GOOGLE_CLIENT_EMAIL ||
        !GOOGLE_PRIVATE_KEY
    ) {

        console.error(
            "❌ GOOGLE SHEETS CONFIG BELUM LENGKAP."
        );

        console.error(
            "Pastikan Railway Variables memiliki:"
        );

        console.error(
            "GOOGLE_SHEET_ID"
        );

        console.error(
            "GOOGLE_CLIENT_EMAIL"
        );

        console.error(
            "GOOGLE_PRIVATE_KEY"
        );

        return false;
    }

    try {

        const auth =
            new google.auth.GoogleAuth({

                credentials: {

                    client_email:
                        GOOGLE_CLIENT_EMAIL,

                    private_key:
                        GOOGLE_PRIVATE_KEY
                },

                scopes: [
                    "https://www.googleapis.com/auth/spreadsheets"
                ]
            });

        sheets =
            google.sheets({
                version: "v4",
                auth
            });

        console.log(
            "✅ Google Sheets API berhasil diinisialisasi."
        );

        return true;

    } catch (error) {

        console.error(
            "❌ Gagal menginisialisasi Google Sheets:"
        );

        console.error(error);

        return false;
    }
}

// ============================================================
// HEADERS GOOGLE SHEETS
// ============================================================

const HEADERS = [

    "id",

    "date",

    "time",

    "direction",

    "entryPrice",

    "tp1Price",

    "tp2Price",

    "slPrice",

    "result",

    "pnl",

    "createdAt",

    "screenshotUrl"
];

// ============================================================
// DATE SEPARATOR CONSTANT
// ============================================================

const DATE_SEPARATOR_ID =
    "DATE_SEPARATOR";

// ============================================================
// ID GENERATOR
// ============================================================

function generateId() {

    return (

        Date.now().toString(36) +

        Math.random()
            .toString(36)
            .substring(2, 8)

    );
}

// ============================================================
// ENSURE GOOGLE SHEET HEADER
// ============================================================

async function ensureSheetHeader() {

    if (!sheets) {

        throw new Error(
            "Google Sheets belum terinisialisasi."
        );
    }

    const range =
        `${SHEET_NAME}!A1:L1`;

    const response =
        await sheets.spreadsheets.values.get({

            spreadsheetId:
                GOOGLE_SHEET_ID,

            range
        });

    const values =
        response.data.values || [];

    // --------------------------------------------------------
    // HEADER BELUM ADA
    // --------------------------------------------------------

    if (
        values.length === 0 ||
        values[0].length === 0
    ) {

        await sheets.spreadsheets.values.update({

            spreadsheetId:
                GOOGLE_SHEET_ID,

            range,

            valueInputOption:
                "RAW",

            requestBody: {

                values: [
                    HEADERS
                ]
            }
        });

        console.log(
            "✅ Header JOURNAL berhasil dibuat."
        );

        return;
    }

    // --------------------------------------------------------
    // HEADER LAMA 11 KOLOM
    // --------------------------------------------------------

    const existingHeaders =
        values[0];

    if (
        existingHeaders.length === 11 &&
        existingHeaders[0] === "id"
    ) {

        await sheets.spreadsheets.values.update({

            spreadsheetId:
                GOOGLE_SHEET_ID,

            range:
                "JOURNAL!L1",

            valueInputOption:
                "RAW",

            requestBody: {

                values: [
                    ["screenshotUrl"]
                ]
            }
        });

        console.log(
            "✅ Kolom screenshotUrl ditambahkan."
        );

        return;
    }

    // --------------------------------------------------------
    // CEK HEADER
    // --------------------------------------------------------

    const headerMatch =
        HEADERS.every(
            (header, index) =>
                existingHeaders[index] === header
        );

    if (!headerMatch) {

        console.warn(
            "⚠️ Header JOURNAL berbeda dari format yang diharapkan."
        );

        console.warn(
            "Header yang diharapkan:"
        );

        console.warn(
            HEADERS
        );
    }
}

// ============================================================
// CHECK DATE SEPARATOR
// ============================================================

async function dateSeparatorExists(date) {

    if (!sheets) {

        throw new Error(
            "Google Sheets belum terhubung."
        );
    }

    const response =
        await sheets.spreadsheets.values.get({

            spreadsheetId:
                GOOGLE_SHEET_ID,

            range:
                `${SHEET_NAME}!A2:B`
        });

    const rows =
        response.data.values || [];

    for (
        let i = 0;
        i < rows.length;
        i++
    ) {

        const id =
            String(
                rows[i][0] || ""
            ).trim();

        const rowDate =
            String(
                rows[i][1] || ""
            ).trim();

        if (
            id === DATE_SEPARATOR_ID &&
            rowDate === String(date).trim()
        ) {

            return true;
        }
    }

    return false;
}

// ============================================================
// CREATE DATE SEPARATOR
// ============================================================

async function ensureDateSeparator(date) {

    if (!sheets) {

        throw new Error(
            "Google Sheets belum terhubung."
        );
    }

    const cleanDate =
        String(date || "").trim();

    if (!cleanDate) {

        throw new Error(
            "Tanggal tidak boleh kosong."
        );
    }

    // --------------------------------------------------------
    // CEK APAKAH SUDAH ADA
    // --------------------------------------------------------

    const exists =
        await dateSeparatorExists(
            cleanDate
        );

    if (exists) {

        return false;
    }

    // --------------------------------------------------------
    // BUAT BARIS SEPARATOR
    // --------------------------------------------------------

    await sheets.spreadsheets.values.append({

        spreadsheetId:
            GOOGLE_SHEET_ID,

        range:
            `${SHEET_NAME}!A:L`,

        valueInputOption:
            "RAW",

        insertDataOption:
            "INSERT_ROWS",

        requestBody: {

            values: [[

                DATE_SEPARATOR_ID,

                cleanDate,

                "",

                "",

                "",

                "",

                "",

                "",

                "",

                "",

                "",

                ""
            ]]
        }
    });

    console.log(
        `📅 DATE SEPARATOR DIBUAT: ${cleanDate}`
    );

    return true;
}

// ============================================================
// FORMAT DATE SEPARATOR
// ============================================================

async function formatDateSeparator(date) {

    try {

        const metadata =
            await sheets.spreadsheets.get({

                spreadsheetId:
                    GOOGLE_SHEET_ID,

                fields:
                    "sheets.properties"
            });

        const journalSheet =
            metadata.data.sheets.find(
                sheet =>
                    sheet.properties.title ===
                    SHEET_NAME
            );

        if (!journalSheet) {

            return;
        }

        const sheetId =
            journalSheet.properties.sheetId;

        const response =
            await sheets.spreadsheets.values.get({

                spreadsheetId:
                    GOOGLE_SHEET_ID,

                range:
                    `${SHEET_NAME}!A:A`
            });

        const rows =
            response.data.values || [];

        let rowNumber = null;

        for (
            let i = 0;
            i < rows.length;
            i++
        ) {

            if (
                String(
                    rows[i][0] || ""
                ).trim() ===
                DATE_SEPARATOR_ID
            ) {

                const dateResponse =
                    await sheets.spreadsheets.values.get({

                        spreadsheetId:
                            GOOGLE_SHEET_ID,

                        range:
                            `${SHEET_NAME}!B${i + 1}`
                    });

                const rowDate =
                    String(
                        dateResponse.data.values?.[0]?.[0] || ""
                    ).trim();

                if (
                    rowDate ===
                    String(date).trim()
                ) {

                    rowNumber =
                        i + 1;

                    break;
                }
            }
        }

        if (!rowNumber) {

            return;
        }

        // ----------------------------------------------------
        // FORMAT BARIS
        // ----------------------------------------------------

        await sheets.spreadsheets.batchUpdate({

            spreadsheetId:
                GOOGLE_SHEET_ID,

            requestBody: {

                requests: [

                    {
                        mergeCells: {

                            range: {

                                sheetId,

                                startRowIndex:
                                    rowNumber - 1,

                                endRowIndex:
                                    rowNumber,

                                startColumnIndex:
                                    0,

                                endColumnIndex:
                                    12
                            },

                            mergeType:
                                "MERGE_ALL"
                        }
                    },

                    {
                        repeatCell: {

                            range: {

                                sheetId,

                                startRowIndex:
                                    rowNumber - 1,

                                endRowIndex:
                                    rowNumber,

                                startColumnIndex:
                                    0,

                                endColumnIndex:
                                    12
                            },

                            cell: {

                                userEnteredFormat: {

                                    horizontalAlignment:
                                        "CENTER",

                                    verticalAlignment:
                                        "MIDDLE",

                                    textFormat: {

                                        bold:
                                            true,

                                        fontSize:
                                            12
                                    }
                                }
                            },

                            fields:
                                "userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat)"
                        }
                    },

                    {
                        updateDimensionProperties: {

                            range: {

                                sheetId,

                                dimension:
                                    "ROWS",

                                startIndex:
                                    rowNumber - 1,

                                endIndex:
                                    rowNumber
                            },

                            properties: {

                                pixelSize:
                                    32
                            },

                            fields:
                                "pixelSize"
                        }
                    }
                ]
            }
        });

        // ----------------------------------------------------
        // UBAH ISI MENJADI TAMPILAN TANGGAL
        // ----------------------------------------------------

        await sheets.spreadsheets.values.update({

            spreadsheetId:
                GOOGLE_SHEET_ID,

            range:
                `${SHEET_NAME}!A${rowNumber}`,

            valueInputOption:
                "RAW",

            requestBody: {

                values: [[
                    `===== ${date} =====`
                ]]
            }
        });

        console.log(
            `🎨 DATE SEPARATOR DIFORMAT: ${date}`
        );

    } catch (error) {

        console.error(
            "⚠️ Gagal memformat date separator:"
        );

        console.error(
            error.message
        );
    }
}

// ============================================================
// GET ALL SIGNALS
// ============================================================

async function getAllSignals() {

    if (!sheets) {

        throw new Error(
            "Google Sheets belum terhubung."
        );
    }

    await ensureSheetHeader();

    const response =
        await sheets.spreadsheets.values.get({

            spreadsheetId:
                GOOGLE_SHEET_ID,

            range:
                `${SHEET_NAME}!A2:L`
        });

    const rows =
        response.data.values || [];

    return rows

        // ----------------------------------------------------
        // HILANGKAN DATE SEPARATOR DARI DATA SIGNAL
        // ----------------------------------------------------

        .filter(row => {

            const id =
                String(
                    row[0] || ""
                ).trim();

            return (
                id !==
                DATE_SEPARATOR_ID
            );
        })

        .map(row => {

            let numericPnl = 0;

            if (
                row[9] !== undefined &&
                row[9] !== ""
            ) {

                numericPnl =
                    Number(row[9]);

                if (
                    Number.isNaN(numericPnl)
                ) {

                    numericPnl = 0;
                }
            }

            return {

                id:
                    row[0] || "",

                date:
                    row[1] || "",

                time:
                    row[2] || "",

                direction:
                    row[3] || "BUY",

                entryPrice:
                    row[4] || "",

                tp1Price:
                    row[5] || "",

                tp2Price:
                    row[6] || "",

                slPrice:
                    row[7] || "",

                result:
                    row[8] || "",

                pnl:
                    numericPnl,

                createdAt:
                    row[10] || "",

                screenshotUrl:
                    row[11] || null
            };
        });
}

// ============================================================
// GET SIGNALS BY DATE
// ============================================================

async function getSignalsByDate(date) {

    const signals =
        await getAllSignals();

    return signals.filter(
        signal =>
            signal.date === date
    );
}

// ============================================================
// GET DATES
// ============================================================

async function getAvailableDates() {

    const signals =
        await getAllSignals();

    const dates =
        new Set();

    signals.forEach(signal => {

        if (signal.date) {

            dates.add(
                signal.date
            );
        }
    });

    return Array.from(dates)
        .sort();
}

// ============================================================
// FIND SIGNAL ROW
// ============================================================

async function findSignalRow(id) {

    if (!sheets) {

        throw new Error(
            "Google Sheets belum terhubung."
        );
    }

    const response =
        await sheets.spreadsheets.values.get({

            spreadsheetId:
                GOOGLE_SHEET_ID,

            range:
                `${SHEET_NAME}!A2:A`
        });

    const rows =
        response.data.values || [];

    for (
        let i = 0;
        i < rows.length;
        i++
    ) {

        const rowId =
            String(
                rows[i][0] || ""
            );

        if (
            rowId ===
            String(id)
        ) {

            return i + 2;
        }
    }

    return null;
}

// ============================================================
// FIND SCREENSHOT ROW
// ============================================================

async function findScreenshotRow(date) {

    if (!sheets) {

        throw new Error(
            "Google Sheets belum terhubung."
        );
    }

    const response =
        await sheets.spreadsheets.values.get({

            spreadsheetId:
                GOOGLE_SHEET_ID,

            range:
                `${SHEET_NAME}!B2:L`
        });

    const rows =
        response.data.values || [];

    for (
        let i = 0;
        i < rows.length;
        i++
    ) {

        const rowDate =
            String(
                rows[i][0] || ""
            );

        const screenshotUrl =
            String(
                rows[i][10] || ""
            );

        if (
            rowDate === String(date) &&
            screenshotUrl
        ) {

            return i + 2;
        }
    }

    return null;
}

// ============================================================
// FIND SHEET ID
// ============================================================

async function getJournalSheetId() {

    const metadata =
        await sheets.spreadsheets.get({

            spreadsheetId:
                GOOGLE_SHEET_ID,

            fields:
                "sheets.properties"
        });

    const journalSheet =
        metadata.data.sheets.find(
            sheet =>
                sheet.properties.title ===
                SHEET_NAME
        );

    if (!journalSheet) {

        throw new Error(
            `Sheet "${SHEET_NAME}" tidak ditemukan.`
        );
    }

    return journalSheet.properties.sheetId;
}

// ============================================================
// EXPRESS JSON
// ============================================================

app.use(
    express.json({
        limit: "15mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "15mb"
    })
);

// ============================================================
// SECURITY HEADERS
// ============================================================

app.use((req, res, next) => {

    res.setHeader(
        "X-Content-Type-Options",
        "nosniff"
    );

    res.setHeader(
        "X-Frame-Options",
        "SAMEORIGIN"
    );

    res.setHeader(
        "Referrer-Policy",
        "strict-origin-when-cross-origin"
    );

    next();
});

// ============================================================
// STATIC
// ============================================================

app.use(
    express.static(PUBLIC_DIR, {

        index: false,

        extensions: [
            "html"
        ],

        maxAge: "1h"
    })
);

// ============================================================
// ADMIN AUTH
// ============================================================

function requireAdmin(
    req,
    res,
    next
) {

    const password =
        req.headers[
            "x-admin-password"
        ];

    if (
        !password ||
        password !==
            ADMIN_PASSWORD
    ) {

        return res.status(401).json({

            success: false,

            error:
                "Akses admin ditolak."
        });
    }

    next();
}

// ============================================================
// HEALTH
// ============================================================

app.get(
    "/health",
    (req, res) => {

        res.status(200).json({

            status: "ok",

            service:
                "AI Assistant Gold Journal",

            database:
                "Google Sheets",

            imageStorage:
                "ImgBB",

            googleSheets:
                Boolean(sheets),

            imgbb:
                Boolean(IMGBB_API_KEY),

            dateSeparator:
                true,

            timestamp:
                new Date().toISOString()
        });
    }
);

// ============================================================
// API STATUS
// ============================================================

app.get(
    "/api/status",
    (req, res) => {

        res.status(200).json({

            success: true,

            message:
                "AI Assistant Gold Journal server is running",

            service:
                "ai-assistant-gold-journal",

            version:
                "4.1.0",

            database:
                "Google Sheets",

            imageStorage:
                "ImgBB",

            sheet:
                SHEET_NAME,

            dateSeparator:
                true,

            node:
                process.version,

            environment:
                process.env.NODE_ENV ||
                "production",

            timestamp:
                new Date().toISOString()
        });
    }
);

// ============================================================
// ADMIN VERIFY
// ============================================================

app.post(
    "/api/admin/verify",
    (req, res) => {

        const password =
            String(
                req.body.password || ""
            );

        if (
            password ===
            ADMIN_PASSWORD
        ) {

            return res.json({

                ok: true
            });
        }

        return res.status(401).json({

            ok: false
        });
    }
);

// ============================================================
// GET DAY
// ============================================================

app.get(
    "/api/day/:date",
    async (req, res) => {

        try {

            const date =
                req.params.date;

            const signals =
                await getSignalsByDate(
                    date
                );

            const screenshotSignal =
                signals.find(
                    signal =>
                        signal.screenshotUrl
                );

            return res.json({

                date,

                signals,

                screenshot:
                    screenshotSignal
                        ? screenshotSignal.screenshotUrl
                        : null
            });

        } catch (error) {

            console.error(
                "❌ GET DAY ERROR:"
            );

            console.error(error);

            return res.status(500).json({

                success: false,

                error:
                    "Gagal mengambil data Google Sheets."
            });
        }
    }
);

// ============================================================
// GET LATEST
// ============================================================

app.get(
    "/api/latest",
    async (req, res) => {

        try {

            const dates =
                await getAvailableDates();

            if (
                !dates.length
            ) {

                return res.json({

                    date: null
                });
            }

            return res.json({

                date:
                    dates[
                        dates.length - 1
                    ]
            });

        } catch (error) {

            console.error(
                "❌ GET LATEST ERROR:"
            );

            console.error(error);

            return res.status(500).json({

                success: false,

                error:
                    "Gagal mengambil tanggal terbaru."
            });
        }
    }
);

// ============================================================
// GET MONTH
// ============================================================

app.get(
    "/api/month/:month",
    async (req, res) => {

        try {

            const month =
                req.params.month;

            const signals =
                await getAllSignals();

            const result = {};

            signals
                .filter(
                    signal =>
                        signal.date &&
                        signal.date.startsWith(
                            month
                        )
                )
                .forEach(
                    signal => {

                        if (
                            !result[
                                signal.date
                            ]
                        ) {

                            result[
                                signal.date
                            ] = {

                                signals: [],

                                screenshot:
                                    null
                            };
                        }

                        result[
                            signal.date
                        ].signals.push(
                            signal
                        );

                        if (
                            signal.screenshotUrl
                        ) {

                            result[
                                signal.date
                            ].screenshot =
                                signal.screenshotUrl;
                        }
                    }
                );

            return res.json(
                result
            );

        } catch (error) {

            console.error(
                "❌ GET MONTH ERROR:"
            );

            console.error(error);

            return res.status(500).json({

                success: false,

                error:
                    "Gagal mengambil data bulan."
            });
        }
    }
);

// ============================================================
// ADD SIGNAL
// ============================================================

app.post(
    "/api/day/:date/signal",
    requireAdmin,
    async (req, res) => {

        try {

            const date =
                req.params.date;

            const {

                time,

                direction,

                entryPrice,

                tp1Price,

                tp2Price,

                slPrice,

                result,

                pnl

            } = req.body;

            // ------------------------------------------------
            // VALIDATION
            // ------------------------------------------------

            if (!time) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Jam signal wajib diisi."
                });
            }

            if (!result) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Hasil signal wajib diisi."
                });
            }

            const allowedDirections = [

                "BUY",

                "SELL"
            ];

            const allowedResults = [

                "TP1",

                "TP2",

                "SL",

                "PENDING",

                "NO SIGNAL"
            ];

            if (
                direction &&
                !allowedDirections.includes(
                    direction
                )
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Arah signal tidak valid."
                });
            }

            if (
                !allowedResults.includes(
                    result
                )
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Hasil signal tidak valid."
                });
            }

            // ------------------------------------------------
            // PASTIKAN DATE SEPARATOR ADA
            // ------------------------------------------------

            const separatorCreated =
                await ensureDateSeparator(
                    date
                );

            if (
                separatorCreated
            ) {

                await formatDateSeparator(
                    date
                );
            }

            // ------------------------------------------------
            // CREATE SIGNAL
            // ------------------------------------------------

            const signal = {

                id:
                    generateId(),

                date:
                    String(
                        date
                    ).trim(),

                time:
                    String(
                        time
                    ).trim(),

                direction:
                    direction === "SELL"
                        ? "SELL"
                        : "BUY",

                entryPrice:
                    entryPrice
                        ? String(
                            entryPrice
                        ).trim()
                        : "",

                tp1Price:
                    tp1Price
                        ? String(
                            tp1Price
                        ).trim()
                        : "",

                tp2Price:
                    tp2Price
                        ? String(
                            tp2Price
                        ).trim()
                        : "",

                slPrice:
                    slPrice
                        ? String(
                            slPrice
                        ).trim()
                        : "",

                result:
                    String(
                        result
                    ).trim(),

                pnl:
                    pnl === "" ||
                    pnl === undefined ||
                    pnl === null
                        ? 0
                        : Number(pnl),

                createdAt:
                    new Date()
                        .toISOString(),

                screenshotUrl:
                    null
            };

            if (
                Number.isNaN(
                    signal.pnl
                )
            ) {

                signal.pnl = 0;
            }

            // ------------------------------------------------
            // SAVE TO GOOGLE SHEETS
            // ------------------------------------------------

            await sheets.spreadsheets.values.append({

                spreadsheetId:
                    GOOGLE_SHEET_ID,

                range:
                    `${SHEET_NAME}!A:L`,

                valueInputOption:
                    "RAW",

                insertDataOption:
                    "INSERT_ROWS",

                requestBody: {

                    values: [[

                        signal.id,

                        signal.date,

                        signal.time,

                        signal.direction,

                        signal.entryPrice,

                        signal.tp1Price,

                        signal.tp2Price,

                        signal.slPrice,

                        signal.result,

                        signal.pnl,

                        signal.createdAt,

                        ""
                    ]]
                }
            });

            console.log(
                `✅ SIGNAL TERSIMPAN: ${signal.date} ${signal.time}`
            );

            return res.json({

                success: true,

                signal
            });

        } catch (error) {

            console.error(
                "❌ ADD SIGNAL ERROR:"
            );

            console.error(error);

            return res.status(500).json({

                success: false,

                error:
                    "Gagal menyimpan signal ke Google Sheets."
            });
        }
    }
);

// ============================================================
// DELETE SIGNAL
// ============================================================

app.delete(
    "/api/day/:date/signal/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const id =
                req.params.id;

            // ------------------------------------------------
            // JANGAN IZINKAN HAPUS DATE SEPARATOR
            // ------------------------------------------------

            if (
                id === DATE_SEPARATOR_ID
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Date separator tidak boleh dihapus melalui endpoint signal."
                });
            }

            const rowNumber =
                await findSignalRow(
                    id
                );

            if (!rowNumber) {

                return res.status(404).json({

                    success: false,

                    error:
                        "Signal tidak ditemukan."
                });
            }

            const sheetId =
                await getJournalSheetId();

            await sheets.spreadsheets.batchUpdate({

                spreadsheetId:
                    GOOGLE_SHEET_ID,

                requestBody: {

                    requests: [{

                        deleteDimension: {

                            range: {

                                sheetId,

                                dimension:
                                    "ROWS",

                                startIndex:
                                    rowNumber - 1,

                                endIndex:
                                    rowNumber
                            }
                        }
                    }]
                }
            });

            console.log(
                `🗑️ SIGNAL DIHAPUS: ${id}`
            );

            return res.json({

                success: true
            });

        } catch (error) {

            console.error(
                "❌ DELETE SIGNAL ERROR:"
            );

            console.error(error);

            return res.status(500).json({

                success: false,

                error:
                    "Gagal menghapus signal."
            });
        }
    }
);

// ============================================================
// IMGBB UPLOAD HELPER
// ============================================================

function uploadToImgBB(base64Image) {

    return new Promise(
        (resolve, reject) => {

            if (
                !IMGBB_API_KEY
            ) {

                return reject(
                    new Error(
                        "IMGBB_API_KEY belum tersedia."
                    )
                );
            }

            if (
                typeof base64Image !==
                "string"
            ) {

                return reject(
                    new Error(
                        "Data gambar tidak valid."
                    )
                );
            }

            let imageData =
                base64Image;

            if (
                imageData.includes(",")
            ) {

                imageData =
                    imageData.split(
                        ","
                    )[1];
            }

            const postData =
                new URLSearchParams({

                    key:
                        IMGBB_API_KEY,

                    image:
                        imageData

                }).toString();

            const options = {

                hostname:
                    "api.imgbb.com",

                path:
                    "/1/upload",

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/x-www-form-urlencoded",

                    "Content-Length":
                        Buffer.byteLength(
                            postData
                        )
                }
            };

            const request =
                https.request(
                    options,
                    response => {

                        let body = "";

                        response.on(
                            "data",
                            chunk => {

                                body +=
                                    chunk;
                            }
                        );

                        response.on(
                            "end",
                            () => {

                                try {

                                    const result =
                                        JSON.parse(
                                            body
                                        );

                                    if (
                                        !result.success ||
                                        !result.data
                                    ) {

                                        return reject(
                                            new Error(
                                                result.error
                                                    ?.message ||
                                                "Upload ImgBB gagal."
                                            )
                                        );
                                    }

                                    const imageUrl =
                                        result.data.display_url ||
                                        result.data.url;

                                    if (
                                        !imageUrl
                                    ) {

                                        return reject(
                                            new Error(
                                                "ImgBB tidak mengembalikan URL gambar."
                                            )
                                        );
                                    }

                                    resolve(
                                        imageUrl
                                    );

                                } catch (
                                    error
                                ) {

                                    reject(
                                        error
                                    );
                                }
                            }
                        );
                    }
                );

            request.on(
                "error",
                error => {

                    reject(
                        error
                    );
                }
            );

            request.write(
                postData
            );

            request.end();
        }
    );
}

// ============================================================
// SAVE SCREENSHOT
// ============================================================

app.post(
    "/api/day/:date/screenshot",
    requireAdmin,
    async (req, res) => {

        try {

            const date =
                req.params.date;

            const screenshot =
                req.body.screenshot;

            // ------------------------------------------------
            // VALIDATION
            // ------------------------------------------------

            if (!screenshot) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Screenshot belum dipilih."
                });
            }

            if (
                typeof screenshot !==
                    "string" ||
                !screenshot.startsWith(
                    "data:image/"
                )
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Format screenshot tidak valid."
                });
            }

            if (
                !IMGBB_API_KEY
            ) {

                return res.status(500).json({

                    success: false,

                    error:
                        "IMGBB_API_KEY belum dikonfigurasi di Railway."
                });
            }

            // ------------------------------------------------
            // PASTIKAN DATE SEPARATOR ADA
            // ------------------------------------------------

            const separatorCreated =
                await ensureDateSeparator(
                    date
                );

            if (
                separatorCreated
            ) {

                await formatDateSeparator(
                    date
                );
            }

            // ------------------------------------------------
            // UPLOAD KE IMGBB
            // ------------------------------------------------

            console.log(
                `📤 Upload screenshot ke ImgBB: ${date}`
            );

            const imageUrl =
                await uploadToImgBB(
                    screenshot
                );

            console.log(
                "✅ ImgBB upload berhasil:"
            );

            console.log(
                imageUrl
            );

            // ------------------------------------------------
            // CARI SIGNAL PADA TANGGAL TERSEBUT
            // ------------------------------------------------

            const signals =
                await getSignalsByDate(
                    date
                );

            // ------------------------------------------------
            // JIKA ADA SIGNAL
            // SIMPAN URL PADA SIGNAL PERTAMA
            // ------------------------------------------------

            if (
                signals.length > 0
            ) {

                const firstSignal =
                    signals[0];

                const rowNumber =
                    await findSignalRow(
                        firstSignal.id
                    );

                if (
                    rowNumber
                ) {

                    await sheets.spreadsheets.values.update({

                        spreadsheetId:
                            GOOGLE_SHEET_ID,

                        range:
                            `${SHEET_NAME}!L${rowNumber}`,

                        valueInputOption:
                            "RAW",

                        requestBody: {

                            values: [[
                                imageUrl
                            ]]
                        }
                    });
                }

            } else {

                /*
                 * Jika belum ada signal,
                 * buat satu baris khusus screenshot.
                 */

                await sheets.spreadsheets.values.append({

                    spreadsheetId:
                        GOOGLE_SHEET_ID,

                    range:
                        `${SHEET_NAME}!A:L`,

                    valueInputOption:
                        "RAW",

                    insertDataOption:
                        "INSERT_ROWS",

                    requestBody: {

                        values: [[

                            generateId(),

                            date,

                            "",

                            "",

                            "",

                            "",

                            "",

                            "",

                            "",

                            0,

                            new Date()
                                .toISOString(),

                            imageUrl

                        ]]
                    }
                });
            }

            return res.json({

                success: true,

                screenshot:
                    imageUrl,

                url:
                    imageUrl
            });

        } catch (error) {

            console.error(
                "❌ SCREENSHOT ERROR:"
            );

            console.error(error);

            return res.status(500).json({

                success: false,

                error:
                    error.message ||
                    "Gagal menyimpan screenshot."
            });
        }
    }
);

// ============================================================
// HOME
// ============================================================

app.get(
    "/",
    (req, res) => {

        const indexPath =
            path.join(
                ROOT_DIR,
                "index.html"
            );

        res.sendFile(
            indexPath,
            error => {

                if (error) {

                    console.error(
                        "❌ Gagal mengirim index.html:"
                    );

                    console.error(
                        error
                    );

                    if (
                        !res.headersSent
                    ) {

                        res.status(
                            500
                        ).send(
                            "index.html tidak ditemukan."
                        );
                    }
                }
            }
        );
    }
);

// ============================================================
// SPA FALLBACK
// ============================================================

app.get(
    "*",
    (req, res, next) => {

        if (
            req.path.startsWith(
                "/api/"
            )
        ) {

            return next();
        }

        if (
            path.extname(
                req.path
            )
        ) {

            return next();
        }

        const indexPath =
            path.join(
                ROOT_DIR,
                "index.html"
            );

        res.sendFile(
            indexPath,
            error => {

                if (error) {

                    next(error);
                }
            }
        );
    }
);

// ============================================================
// 404
// ============================================================

app.use(
    (req, res) => {

        if (
            req.path.startsWith(
                "/api/"
            )
        ) {

            return res.status(
                404
            ).json({

                success: false,

                error:
                    "API endpoint tidak ditemukan",

                path:
                    req.path
            });
        }

        res.status(
            404
        ).send(`

<!DOCTYPE html>

<html lang="id">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>404</title>

</head>

<body style="
background:#0b0f14;
color:white;
font-family:Arial;
text-align:center;
padding:80px 20px;
">

<h1>404</h1>

<p>
Halaman tidak ditemukan.
</p>

<a href="/" style="
color:white;
">

Kembali ke Dashboard

</a>

</body>

</html>

`);
    }
);

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
    (
        err,
        req,
        res,
        next
    ) => {

        console.error(
            "=============================================="
        );

        console.error(
            "❌ EXPRESS SERVER ERROR"
        );

        console.error(
            "=============================================="
        );

        console.error(
            err
        );

        if (
            res.headersSent
        ) {

            return next(err);
        }

        if (
            req.path.startsWith(
                "/api/"
            )
        ) {

            return res.status(
                500
            ).json({

                success: false,

                error:
                    "Internal Server Error"
            });
        }

        res.status(
            500
        ).send(`

<!DOCTYPE html>

<html lang="id">

<head>

<meta charset="UTF-8">

<title>500</title>

</head>

<body style="
background:#0b0f14;
color:white;
font-family:Arial;
text-align:center;
padding:60px 20px;
">

<h1>500</h1>

<p>
Terjadi kesalahan pada server.
</p>

<a href="/" style="color:white;">
Kembali
</a>

</body>

</html>

`);
    }
);

// ============================================================
// INITIALIZE GOOGLE SHEETS
// ============================================================

initializeGoogleSheets();

// ============================================================
// START SERVER
// ============================================================

const server =
    app.listen(
        PORT,
        "0.0.0.0",
        async () => {

            console.log("");

            console.log(
                "=============================================="
            );

            console.log(
                "🚀 AI ASSISTANT GOLD JOURNAL"
            );

            console.log(
                "=============================================="
            );

            console.log(
                `🌐 Server : 0.0.0.0:${PORT}`
            );

            console.log(
                `📁 Root   : ${ROOT_DIR}`
            );

            console.log(
                "💾 Data   : GOOGLE SHEETS"
            );

            console.log(
                `📊 Sheet  : ${SHEET_NAME}`
            );

            console.log(
                "🖼️ Image  : ImgBB"
            );

            console.log(
                "📅 Date Separator : ENABLED"
            );

            console.log(
                "🟢 Health : /health"
            );

            console.log(
                "🔵 API    : /api/status"
            );

            console.log(
                "🔐 Admin  : ENABLED"
            );

            console.log(
                "=============================================="
            );

            // ------------------------------------------------
            // GOOGLE SHEETS TEST
            // ------------------------------------------------

            if (
                sheets
            ) {

                try {

                    await ensureSheetHeader();

                    console.log(
                        "✅ GOOGLE SHEETS TERHUBUNG"
                    );

                } catch (
                    error
                ) {

                    console.error(
                        "❌ GOOGLE SHEETS TIDAK BISA DIAKSES"
                    );

                    console.error(
                        error.message
                    );
                }

            } else {

                console.error(
                    "❌ GOOGLE SHEETS BELUM TERKONFIGURASI"
                );
            }

            // ------------------------------------------------
            // IMGBB TEST
            // ------------------------------------------------

            if (
                IMGBB_API_KEY
            ) {

                console.log(
                    "✅ IMGBB API KEY TERDETEKSI"
                );

            } else {

                console.error(
                    "❌ IMGBB_API_KEY BELUM TERKONFIGURASI"
                );
            }

            console.log(
                "=============================================="
            );

            console.log(
                "✅ SERVER BERHASIL START"
            );

            console.log(
                "=============================================="
            );

            console.log("");
        }
    );

// ============================================================
// SERVER ERROR
// ============================================================

server.on(
    "error",
    error => {

        console.error(
            "❌ SERVER ERROR"
        );

        console.error(
            error
        );
    }
);

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

function shutdown(
    signal
) {

    console.log(
        `⚠️ ${signal} diterima.`
    );

    console.log(
        "🛑 Menghentikan server..."
    );

    server.close(
        () => {

            console.log(
                "✅ Server berhasil dihentikan."
            );

            process.exit(
                0
            );
        }
    );
}

process.on(
    "SIGTERM",
    () =>
        shutdown(
            "SIGTERM"
        )
);

process.on(
    "SIGINT",
    () =>
        shutdown(
            "SIGINT"
        )
);

// ============================================================
// UNCAUGHT ERRORS
// ============================================================

process.on(
    "uncaughtException",
    error => {

        console.error(
            "❌ UNCAUGHT EXCEPTION"
        );

        console.error(
            error
        );
    }
);

process.on(
    "unhandledRejection",
    reason => {

        console.error(
            "❌ UNHANDLED PROMISE REJECTION"
        );

        console.error(
            reason
        );
    }
);
