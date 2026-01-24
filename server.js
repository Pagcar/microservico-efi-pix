const express = require('express');
const EfiPay = require('sdk-node-apis-efi');
const path = require('path');

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

const PORT = process.env.PORT || 3000;

const options = {
    client_id: process.env.EFI_CLIENT_ID,
    client_secret: process.env.EFI_CLIENT_SECRET,
    certificate: path.resolve(__dirname, 'certificado.p12'),
    sandbox: false
};

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/pix/create', async (req, res) => {
    try {
        const { txid, valor, descricao } = req.body;
        
        const efipay = new EfiPay(options);
        
        const body = {
            calendario: { expiracao: 3600 },
            valor: { original: parseFloat(valor).toFixed(2) },
            chave: process.env.EFI_PIX_KEY,
            solicitacaoPagador: descricao || 'Contribuição para caixinha'
        };

        const params = txid ? { txid } : {};
        const cobResponse = await efipay.pixCreateImmediateCharge(params, body);
        const qrResponse = await efipay.pixGenerateQRCode({ id: cobResponse.loc.id });

        res.json({
            success: true,
            txid: cobResponse.txid,
            loc_id: cobResponse.loc.id,
            qrcode: qrResponse.qrcode,
            imagemQrcode: qrResponse.imagemQrcode
        });
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.stack 
        });
    }
});

app.post('/api/pix/consultar', async (req, res) => {
    try {
        const { txid } = req.body;
        
        if (!txid) {
            return res.status(400).json({ success: false, error: 'txid é obrigatório' });
        }
        
        const efipay = new EfiPay(options);
        const cobranca = await efipay.pixDetailCharge({ txid });

        res.json({
            success: true,
            data: {
                txid: cobranca.txid,
                status: cobranca.status,
                valor: cobranca.valor?.original,
                qr_code: cobranca.pixCopiaECola,
                copia_e_cola: cobranca.pixCopiaECola
            }
        });
    } catch (error) {
        console.error('❌ Erro ao consultar:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Microserviço EFI rodando na porta ${PORT}`);
});
