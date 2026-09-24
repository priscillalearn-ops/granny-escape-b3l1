# -*- coding: utf-8 -*-
"""把 index.html 裡的 UNITS／PRESETS 抽出來，產生 parkour/units.js（跑酷小遊戲共用同一份題庫）。
用法：python3 tools/build_units.py"""
import re,os,sys
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src=open(os.path.join(root,'index.html'),encoding='utf8').read()
def grab(name):
    """從 const NAME=[ 開始做括號配對，把整個陣列原封不動抓出來（字串裡的括號會跳過）"""
    i=src.index('const %s=['%name)+len('const %s='%name)
    depth=0; k=i; instr=None
    while k<len(src):
        ch=src[k]
        if instr:
            if ch=='\\': k+=2; continue
            if ch==instr: instr=None
        else:
            if ch in '"\'': instr=ch
            elif ch in '[{': depth+=1
            elif ch in ']}':
                depth-=1
                if depth==0: return src[i:k+1]
        k+=1
    raise SystemExit('找不到 '+name+' 的結尾')
units=grab('UNITS'); presets=grab('PRESETS')
out='/* 這個檔案是 tools/build_units.py 從 index.html 自動產生的，不要手動改 */\n'
out+='window.UNITS='+units+'\n'
out+='window.PRESETS='+presets+'\n'
p=os.path.join(root,'parkour','units.js')
open(p,'w',encoding='utf8').write(out)
print('寫入',p,round(len(out)/1024),'KB')
