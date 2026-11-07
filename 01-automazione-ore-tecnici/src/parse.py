import openpyxl,glob,datetime as dt,json,sys
def hrs(v):
    if v in (None,''): return 0.0
    if isinstance(v,dt.time): return v.hour+v.minute/60
    if isinstance(v,dt.timedelta): return v.total_seconds()/3600
    if isinstance(v,(int,float)): return v*24 if v<1.5 else float(v)
    raise ValueError(v)
out=[]
for p in sorted(glob.glob(sys.argv[1]+'/*.xlsx')):
    src=p.split('/')[-1][:-5]
    wb=openpyxl.load_workbook(p,data_only=True)
    for sn in wb.sheetnames:
        if not sn[:1].isdigit(): continue
        ws=wb[sn]; hdr=None
        for r in range(1,ws.max_row+1):
            if ws.cell(r,1).value=='DATA' and ws.cell(r,2).value=='NOME TECNICO': hdr=r;break
        if not hdr: print('NOHDR',src,sn); continue
        r=hdr+1
        while r<=ws.max_row and ws.cell(r,1).value!="ATTIVITA' SVOLTE:":
            d,n=ws.cell(r,1).value,ws.cell(r,2).value
            if d or n:
                out.append(dict(src=src,sheet=sn,row=r,date=d.strftime('%Y-%m-%d') if isinstance(d,dt.datetime) else str(d),
                  name=(n or '').strip(),prep=bool(ws.cell(r,3).value),strao=hrs(ws.cell(r,8).value),
                  tot=hrs(ws.cell(r,9).value),viaggio=hrs(ws.cell(r,10).value),imp=(ws.cell(r,11).value or '').strip()))
            r+=1
json.dump(out,open(sys.argv[2],'w'),indent=0)
print(len(out))
for o in out:
    if not o['name'] or o['tot']==0: print('CHECK',o)
