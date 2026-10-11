// L-17: dependency-free Office Open XML workbook writer.
// Uses a standards-compliant ZIP container with stored (uncompressed) XML.
// Cells are inline strings, so user-supplied legal text is NEVER evaluated
// as formulas, including values starting with = + - or @.
const encoder=new TextEncoder();
type ZipEntry={name:string;data:Uint8Array};

function crc32(bytes:Uint8Array):number {
  let crc=0xffffffff;
  for(const byte of bytes){
    crc ^= byte;
    for(let n=0;n<8;n++)crc=(crc>>>1) ^ ((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
}

function concat(parts:Uint8Array[]):Uint8Array {
  const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));
  let offset=0;
  for(const part of parts){result.set(part,offset);offset+=part.length;}
  return result;
}

function zipStored(files:ZipEntry[]):Uint8Array {
  const local:Uint8Array[]=[];
  const central:Uint8Array[]=[];
  let offset=0;
  for(const file of files){
    const filename=encoder.encode(file.name);
    const crc=crc32(file.data);
    const header=new Uint8Array(30+filename.length);
    const h=new DataView(header.buffer);
    h.setUint32(0,0x04034b50,true);
    h.setUint16(4,20,true);
    h.setUint16(6,0,true);
    h.setUint16(8,0,true);
    h.setUint32(14,crc,true);
    h.setUint32(18,file.data.length,true);
    h.setUint32(22,file.data.length,true);
    h.setUint16(26,filename.length,true);
    header.set(filename,30);
    const directory=new Uint8Array(46+filename.length);
    const d=new DataView(directory.buffer);
    d.setUint32(0,0x02014b50,true);
    d.setUint16(4,20,true);
    d.setUint16(6,20,true);
    d.setUint32(16,crc,true);
    d.setUint32(20,file.data.length,true);
    d.setUint32(24,file.data.length,true);
    d.setUint16(28,filename.length,true);
    d.setUint32(42,offset,true);
    directory.set(filename,46);
    central.push(directory);
    local.push(header,file.data);
    offset+=header.length+file.data.length;
  }
  const dirSize=central.reduce((n,x)=>n+x.length,0);
  const end=new Uint8Array(22);
  const e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);
  e.setUint16(8,files.length,true);
  e.setUint16(10,files.length,true);
  e.setUint32(12,dirSize,true);
  e.setUint32(16,offset,true);
  return concat([...local,...central,end]);
}

function xmlEscape(v:string):string {
  return v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'')
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;')
    .replaceAll("'",'&apos;');
}

function columnLetter(index:number):string {
  let col='';
  for(let n=index+1;n>0;n=Math.floor((n-1)/26))col=String.fromCharCode(65+(n-1)%26)+col;
  return col;
}

const contentTypes='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
  '<Default Extension="xml" ContentType="application/xml"/>'+
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+
  '</Types>';

export function buildCollectionDiscardsWorkbook(headers:string[],rows:string[][]):Blob {
  if(rows.some(row=>row.length!==headers.length))throw new Error('invalid_xlsx_row_shape');
  const all=[headers,...rows];
  const cell=(value:string,r:number,c:number)=>
    '<c r="'+columnLetter(c)+(r+1)+'" t="inlineStr"><is><t xml:space="preserve">'+
    xmlEscape(value)+'</t></is></c>';
  const sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<sheetData>'+all.map((row,r)=>'<row r="'+(r+1)+'">'+
      row.map((value,c)=>cell(value,r,c)).join('')+'</row>').join('')+
    '</sheetData></worksheet>';
  const entries:ZipEntry[]=[
    {name:'[Content_Types].xml',data:encoder.encode(contentTypes)},
    {name:'_rels/.rels',data:encoder.encode('<?xml version="1.0" encoding="UTF-8"?>'+
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'+
      '</Relationships>')},
    {name:'xl/workbook.xml',data:encoder.encode('<?xml version="1.0" encoding="UTF-8"?>'+
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '+
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
      '<sheets><sheet name="Desconsiderados" sheetId="1" r:id="rId1"/></sheets></workbook>')},
    {name:'xl/_rels/workbook.xml.rels',data:encoder.encode('<?xml version="1.0" encoding="UTF-8"?>'+
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'+
      '</Relationships>')},
    {name:'xl/worksheets/sheet1.xml',data:encoder.encode(sheet)},
  ];
  const binary=zipStored(entries);
  return new Blob([binary.buffer as ArrayBuffer],{
    type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
