/**
 * Utility functions for generating and downloading CSV/XML templates
 */

export const generateCSVTemplate = (): string => {
  const headers = "code,title,image_url,sale_price,promotional_price,description,product_url";
  const row1 = '"BOOK001","Bitwa Warszawska 1920","https://example.com/cover1.jpg",49.99,39.99,"Szczegółowy opis Cudu nad Wisłą i bohaterstwa polskich żołnierzy.","https://sklep.pl/bitwa-warszawska"';
  const row2 = '"BOOK002","Konstytucja 3 Maja","https://example.com/cover2.jpg",39.99,,"Historia pierwszej konstytucji w Europie i jej znaczenie dla Polski.","https://sklep.pl/konstytucja"';
  const row3 = '"BOOK003","Powstanie Warszawskie","https://example.com/cover3.jpg",59.99,49.99,"Opowieść o heroicznej walce mieszkańców Warszawy w 1944 roku.","https://sklep.pl/powstanie-warszawskie"';
  
  return `${headers}\n${row1}\n${row2}\n${row3}`;
};

export const generateXMLTemplate = (): string => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<books>
  <book>
    <code>BOOK001</code>
    <title>Bitwa Warszawska 1920</title>
    <image_url>https://example.com/cover1.jpg</image_url>
    <sale_price>49.99</sale_price>
    <promotional_price>39.99</promotional_price>
    <description>Szczegółowy opis Cudu nad Wisłą i bohaterstwa polskich żołnierzy.</description>
    <product_url>https://sklep.pl/bitwa-warszawska</product_url>
  </book>
  <book>
    <code>BOOK002</code>
    <title>Konstytucja 3 Maja</title>
    <image_url>https://example.com/cover2.jpg</image_url>
    <sale_price>39.99</sale_price>
    <description>Historia pierwszej konstytucji w Europie i jej znaczenie dla Polski.</description>
    <product_url>https://sklep.pl/konstytucja</product_url>
  </book>
  <book>
    <code>BOOK003</code>
    <title>Powstanie Warszawskie</title>
    <image_url>https://example.com/cover3.jpg</image_url>
    <sale_price>59.99</sale_price>
    <promotional_price>49.99</promotional_price>
    <description>Opowieść o heroicznej walce mieszkańców Warszawy w 1944 roku.</description>
    <product_url>https://sklep.pl/powstanie-warszawskie</product_url>
  </book>
</books>`;
};

export const downloadTemplate = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
