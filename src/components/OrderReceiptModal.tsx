import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Printer, FileText, CheckCircle2 } from "lucide-react";

export interface ReceiptOrder {
  id: string;
  user_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  address?: string | null;
  service_name?: string | null;
  price?: number | null;
  final_price?: number | null;
  payment_amount?: number | null;
  delivery_fee?: number | null;
  service_fee?: number | null;
  vat_rate?: number | string | null;
  vat_amount?: number | string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  status?: string | null;
  pickup_date?: string | null;
  pickup_time?: string | null;
  return_date?: string | null;
  return_time?: string | null;
  created_at?: string | null;
  order_items?: Array<{
    id?: string;
    service_name?: string;
    product_name?: string | null;
    quantity: number;
    unit_price?: number;
    total_price: number;
  }>;
}

interface OrderReceiptModalProps {
  order: ReceiptOrder | null;
  isOpen: boolean;
  onClose: () => void;
  laundryName?: string | null;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({
  order,
  isOpen,
  onClose,
  laundryName,
}) => {
  if (!order) return null;

  const totalAmount = parseFloat(
    String(order.payment_amount ?? order.final_price ?? order.price ?? 0)
  );
  const vatRate = typeof order.vat_rate === "number" ? order.vat_rate : 25.5;
  const serviceFee = typeof order.service_fee === "number" ? order.service_fee : parseFloat(String(order.service_fee || "0"));
  const deliveryFee = typeof order.delivery_fee === "number" ? order.delivery_fee : parseFloat(String(order.delivery_fee || "0"));

  const vatMultiplier = 1 + vatRate / 100;
  const totalVat = order.vat_amount != null
    ? parseFloat(String(order.vat_amount))
    : totalAmount > 0
    ? totalAmount - totalAmount / vatMultiplier
    : 0;
  const netAmount = totalAmount - totalVat;

  const receiptDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString("fi-FI", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleDateString("fi-FI");

  const orderShortId = `#${order.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}`;
  const customerName = `${order.first_name || ""} ${order.last_name || ""}`.trim() || "Asiakas";

  const paymentMethodLabel = (() => {
    const pm = (order.payment_method || "").toLowerCase();
    if (pm.includes("card") || pm.includes("stripe")) return "Korttimaksu / Verkkomaksu";
    if (pm.includes("invoice")) return "Lasku";
    if (pm.includes("cash")) return "Käteinen";
    if (pm.includes("mobile")) return "Mobiilimaksu";
    return "Verkkomaksu";
  })();

  const paymentStatusLabel = order.payment_status === "paid" || order.status === "completed" || order.status === "delivered"
    ? "Maksettu"
    : "Vahvistettu";

  // Tulostustoiminto / PDF-lataus selaimen natiivilla print-dialogilla
  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=850,height=1000");
    if (!printWindow) {
      window.print();
      return;
    }

    const itemsHtml = (order.order_items && order.order_items.length > 0)
      ? order.order_items.map((it) => `
        <tr>
          <td style="padding: 9px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #1E293B;">
            <strong>${it.product_name || it.service_name || "Pesupalvelu"}</strong>
          </td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 13px; color: #475569;">
            ${it.quantity} kpl
          </td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 13px; color: #475569;">
            25,5 %
          </td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-size: 13px; font-weight: 700; color: #0F172A;">
            ${Number(it.total_price).toFixed(2).replace(".", ",")} €
          </td>
        </tr>
      `).join("")
      : `
        <tr>
          <td style="padding: 9px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #1E293B;">
            <strong>${order.service_name || "Pesuni-pesupalvelu"}</strong>
          </td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 13px; color: #475569;">
            1 kpl
          </td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 13px; color: #475569;">
            25,5 %
          </td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-size: 13px; font-weight: 700; color: #0F172A;">
            ${Math.max(0, totalAmount - deliveryFee - serviceFee).toFixed(2).replace(".", ",")} €
          </td>
        </tr>
      `;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fi">
      <head>
        <meta charset="UTF-8">
        <title>Pesuni_Kuitti_${order.id.slice(0, 8)}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0F172A;
            line-height: 1.5;
            padding: 0;
            margin: 0;
            background: #fff;
          }
          .receipt-container {
            max-width: 760px;
            margin: 0 auto;
            border: 1px solid #E2E8F0;
            border-radius: 12px;
            padding: 36px;
            background: #fff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #08B6FF;
            padding-bottom: 20px;
            margin-bottom: 24px;
          }
          .brand-title {
            font-size: 26px;
            font-weight: 900;
            color: #08B6FF;
            letter-spacing: -0.5px;
            margin: 0;
          }
          .receipt-badge {
            display: inline-block;
            background: #F0F9FF;
            color: #0369A1;
            border: 1px solid #BAE6FD;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            margin-top: 6px;
            text-transform: uppercase;
          }
          .company-info {
            text-align: right;
            font-size: 12px;
            color: #475569;
          }
          .company-info strong {
            color: #0F172A;
            font-size: 14px;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 24px;
          }
          .meta-box {
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            padding: 14px;
            font-size: 12px;
          }
          .meta-box-title {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748B;
            margin-bottom: 6px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            margin-bottom: 20px;
          }
          th {
            background: #F1F5F9;
            color: #475569;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            padding: 8px 12px;
            border-bottom: 1px solid #CBD5E1;
            text-align: left;
          }
          .summary-box {
            margin-top: 20px;
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            padding: 16px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            padding: 4px 0;
            color: #475569;
          }
          .summary-total {
            display: flex;
            justify-content: space-between;
            font-size: 18px;
            font-weight: 900;
            color: #0F172A;
            border-top: 2px solid #CBD5E1;
            padding-top: 10px;
            margin-top: 8px;
          }
          .legal-footer {
            margin-top: 36px;
            padding-top: 16px;
            border-top: 1px solid #E2E8F0;
            text-align: center;
            font-size: 11px;
            color: #94A3B8;
            line-height: 1.6;
          }
          @media print {
            body { padding: 0; }
            .receipt-container { border: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <!-- HEADER -->
          <div class="header">
            <div>
              <div class="brand-title">PESUNI</div>
              <div class="receipt-badge">Virallinen ostokuitti / Official Receipt</div>
              <div style="font-size: 12px; margin-top: 8px; color: #475569;">
                Tilausnumero: <strong>${orderShortId}</strong><br/>
                Kuitin pvm: ${receiptDate}
              </div>
            </div>
            <div class="company-info">
              <strong>Pesuni Oy</strong><br/>
              Y-tunnus: 3245678-9<br/>
              Nuijamiestentie 5, 00400 Helsinki<br/>
              asiakaspalvelu@pesuni.fi | +358 40 142 2449<br/>
              www.pesuni.fi
            </div>
          </div>

          <!-- ASIAKAS & LOGISTIIKKA -->
          <div class="meta-grid">
            <div class="meta-box">
              <div class="meta-box-title">Asiakastiedot & Toimitusosoite</div>
              <strong style="font-size: 13px; color: #0F172A;">${customerName}</strong><br/>
              Puhelin: ${order.phone || "-"}<br/>
              Osoite: ${order.address || "-"}<br/>
              Maksutapa: ${paymentMethodLabel} (${paymentStatusLabel})
            </div>
            <div class="meta-box">
              <div class="meta-box-title">Aikataulu & Palvelu</div>
              Noutoaika: <strong>${order.pickup_date || "-"} ${order.pickup_time ? `klo ${order.pickup_time}` : ""}</strong><br/>
              Palautusaika: <strong>${order.return_date || "-"} ${order.return_time ? `klo ${order.return_time}` : ""}</strong><br/>
              ${laundryName ? `Kumppanipesula: <strong>${laundryName}</strong><br/>` : ""}
              Tositekoodi: <code>${order.id}</code>
            </div>
          </div>

          <!-- TUOTETAULUKKO -->
          <table>
            <thead>
              <tr>
                <th>Tuote / Palvelu</th>
                <th style="text-align: center;">Määrä</th>
                <th style="text-align: center;">ALV %</th>
                <th style="text-align: right;">Yhteensä</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              ${deliveryFee > 0 ? `
                <tr>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #1E293B;">Kotiinkuljetus (nouto & palautus)</td>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 13px; color: #475569;">1</td>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 13px; color: #475569;">25,5 %</td>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-size: 13px; font-weight: 700; color: #0F172A;">${deliveryFee.toFixed(2).replace(".", ",")} €</td>
                </tr>
              ` : `
                <tr>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #1E293B;">Kotiinkuljetus (nouto & palautus)</td>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 13px; color: #475569;">1</td>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 13px; color: #475569;">25,5 %</td>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-size: 13px; font-weight: 700; color: #10B981;">0,00 € (Maksuton)</td>
                </tr>
              `}
              ${serviceFee > 0 ? `
                <tr>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #1E293B;">Palvelumaksu</td>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 13px; color: #475569;">1</td>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 13px; color: #475569;">25,5 %</td>
                  <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-size: 13px; font-weight: 700; color: #0F172A;">${serviceFee.toFixed(2).replace(".", ",")} €</td>
                </tr>
              ` : ""}
            </tbody>
          </table>

          <!-- YHTEENVETO JA VEROERITTELY -->
          <div class="summary-box">
            <div class="summary-row">
              <span>Veroton hinta (netto 0% ALV):</span>
              <strong style="color: #0F172A;">${netAmount.toFixed(2).replace(".", ",")} €</strong>
            </div>
            <div class="summary-row">
              <span>Arvonlisävero ALV (${vatRate.toString().replace(".", ",")}%):</span>
              <strong style="color: #0F172A;">${totalVat.toFixed(2).replace(".", ",")} €</strong>
            </div>
            <div class="summary-row">
              <span>Maksutapa & Tila:</span>
              <span>${paymentMethodLabel} · ${paymentStatusLabel}</span>
            </div>
            <div class="summary-total">
              <span>YHTEENSÄ (sis. ALV):</span>
              <span>${totalAmount.toFixed(2).replace(".", ",")} €</span>
            </div>
          </div>

          <!-- LEGAL FOOTER -->
          <div class="legal-footer">
            Pesuni Oy – Kiitos tilauksestasi!<br/>
            Tämä on arvonlisäverolain (ALV-laki 209 §) mukainen virallinen ja kirjanpitokelpoinen ostokuitti.<br/>
            Säilytä tosite kirjanpitoa tai mahdollista yhteydenottoa varten.
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl">
        {/* MODAL HEADER */}
        <div className="p-5 border-b bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                Virallinen Ostokuitti {orderShortId}
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {paymentStatusLabel}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Kirjanpitokelpoinen tosite ALV-erittelyineen (ALV-laki 209 §)
              </DialogDescription>
            </div>
          </div>

          <Button
            size="sm"
            onClick={handlePrint}
            className="h-8 px-3 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm flex items-center gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Tulosta / Tallenna PDF
          </Button>
        </div>

        {/* KUITIN SISÄLTÖ */}
        <div className="p-6 space-y-5 text-xs text-foreground bg-card">
          
          {/* YRITYS JA KUITIN METATIEDOT */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 pb-4 border-b">
            <div>
              <h3 className="text-xl font-black text-primary tracking-tight">PESUNI</h3>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                Pyykin nouto- ja pesupalvelu
              </p>
              <div className="mt-2 space-y-0.5 text-muted-foreground">
                <p>Tilaustunnus: <span className="font-mono font-bold text-foreground">{orderShortId}</span></p>
                <p>Kuitin pvm: <span className="text-foreground font-medium">{receiptDate}</span></p>
              </div>
            </div>

            <div className="sm:text-right space-y-0.5 text-muted-foreground">
              <p className="font-bold text-foreground text-sm">Pesuni Oy</p>
              <p>Y-tunnus: 3245678-9</p>
              <p>Nuijamiestentie 5, 00400 Helsinki</p>
              <p>asiakaspalvelu@pesuni.fi</p>
              <p>www.pesuni.fi</p>
            </div>
          </div>

          {/* ASIAKAS & AIKATAULUT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Asiakas & Toimitus
              </span>
              <p className="font-bold text-sm text-foreground">{customerName}</p>
              {order.phone && <p className="text-muted-foreground">Puh: {order.phone}</p>}
              {order.address && <p className="text-muted-foreground">Osoite: {order.address}</p>}
            </div>

            <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Logistiikka & Maksutapa
              </span>
              <p className="text-muted-foreground">
                Nouto: <strong className="text-foreground">{order.pickup_date || "-"} {order.pickup_time ? `klo ${order.pickup_time}` : ""}</strong>
              </p>
              <p className="text-muted-foreground">
                Palautus: <strong className="text-foreground">{order.return_date || "-"} {order.return_time ? `klo ${order.return_time}` : ""}</strong>
              </p>
              <p className="text-muted-foreground">
                Maksutapa: <strong className="text-foreground">{paymentMethodLabel}</strong>
              </p>
            </div>
          </div>

          {/* TUOTTEET JA ERITTELY */}
          <div className="border rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-[11px] font-bold text-muted-foreground uppercase border-b">
                <tr>
                  <th className="py-2 px-3 text-left">Tuote / Palvelu</th>
                  <th className="py-2 px-3 text-center w-[70px]">Määrä</th>
                  <th className="py-2 px-3 text-center w-[70px]">ALV</th>
                  <th className="py-2 px-3 text-right w-[90px]">Yhteensä</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.order_items && order.order_items.length > 0 ? (
                  order.order_items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-muted/20">
                      <td className="py-2 px-3 font-medium text-foreground">
                        {item.product_name || item.service_name || "Pyykkipalvelu"}
                      </td>
                      <td className="py-2 px-3 text-center text-muted-foreground">{item.quantity} kpl</td>
                      <td className="py-2 px-3 text-center text-muted-foreground">25,5 %</td>
                      <td className="py-2 px-3 text-right font-bold text-foreground">
                        {Number(item.total_price).toFixed(2)} €
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="hover:bg-muted/20">
                    <td className="py-2 px-3 font-medium text-foreground">{order.service_name || "Pesuni-Kassi (9 kg)"}</td>
                    <td className="py-2 px-3 text-center text-muted-foreground">1 kpl</td>
                    <td className="py-2 px-3 text-center text-muted-foreground">25,5 %</td>
                    <td className="py-2 px-3 text-right font-bold text-foreground">
                      {Math.max(0, totalAmount - deliveryFee - serviceFee).toFixed(2)} €
                    </td>
                  </tr>
                )}

                {/* Kuljetusmaksu */}
                <tr className="hover:bg-muted/20">
                  <td className="py-2 px-3 text-muted-foreground">Kotiinkuljetus (nouto ja palautus)</td>
                  <td className="py-2 px-3 text-center text-muted-foreground">1</td>
                  <td className="py-2 px-3 text-center text-muted-foreground">25,5 %</td>
                  <td className="py-2 px-3 text-right font-medium text-foreground">
                    {deliveryFee > 0 ? `${deliveryFee.toFixed(2)} €` : "0,00 € (Maksuton)"}
                  </td>
                </tr>

                {/* Palvelumaksu */}
                {serviceFee > 0 && (
                  <tr className="hover:bg-muted/20">
                    <td className="py-2 px-3 text-muted-foreground">Palvelumaksu</td>
                    <td className="py-2 px-3 text-center text-muted-foreground">1</td>
                    <td className="py-2 px-3 text-center text-muted-foreground">25,5 %</td>
                    <td className="py-2 px-3 text-right font-medium text-foreground">
                      {serviceFee.toFixed(2)} €
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* VERO- JA HINTAYHTEENVETO */}
          <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
            <div className="flex justify-between text-muted-foreground">
              <span>Veroton hinta (netto 0% ALV):</span>
              <span className="font-semibold text-foreground">{netAmount.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Arvonlisävero ALV ({vatRate.toString().replace(".", ",")}%):</span>
              <span className="font-semibold text-foreground">{totalVat.toFixed(2)} €</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center text-base font-black text-foreground pt-1">
              <span>YHTEENSÄ (sis. ALV):</span>
              <span className="text-xl text-primary font-black">{totalAmount.toFixed(2)} €</span>
            </div>
          </div>

          {/* VIRALLINEN TOSITE -ALAOSA */}
          <div className="text-center pt-2 text-[11px] text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground">Pesuni Oy – Kiitos tilauksestasi!</p>
            <p>Tämä on arvonlisäverolain (ALV-laki 209 §) mukainen virallinen ja kirjanpitokelpoinen ostokuitti.</p>
            <p>Säilytysaika kirjanpitolain mukaisesti.</p>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <DialogFooter className="p-4 border-t bg-muted/10 flex items-center justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Sulje
          </Button>

          <Button
            size="sm"
            onClick={handlePrint}
            className="text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Tulosta / Tallenna PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
