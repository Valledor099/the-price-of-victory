"""Adapt MakeHuman HM08 assets to Fair Play. SOURCE is a local asset folder.
Run build_boxer(source, collection) inside Blender. All mesh coordinates
until mesh creation use MakeHuman's Y-up space, also used by the web scene.
"""
import json
import re
import runpy
from math import sin,cos,pi
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector, Matrix


def read_obj(path):
    vertices, uv, faces = [], [], []
    group = ''
    for line in path.read_text(encoding='utf-8').splitlines():
        parts = line.split()
        if not parts: continue
        if parts[0] == 'v': vertices.append(tuple(map(float,parts[1:4])))
        elif parts[0] == 'vt': uv.append(tuple(map(float,parts[1:3])))
        elif parts[0] == 'g': group = parts[1]
        elif parts[0] == 'f':
            corners=[tuple(int(k)-1 for k in item.split('/')[:2]) for item in parts[1:]]
            faces.append((group,corners))
    return np.array(vertices),uv,faces


def texture(name, path, alpha=False):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Roughness'].default_value=.68
    tex=m.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image=bpy.data.images.load(str(path),check_existing=True)
    tex.image.pack()
    m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
    if alpha:
        m.node_tree.links.new(tex.outputs['Alpha'],p.inputs['Alpha'])
        m.surface_render_method='DITHERED'
        m.use_backface_culling=False
    return m


def to_blender(v):
    return (v[0],-v[2],v[1])


def component_weights(source,skel,n,source_bones):
    # Each fine joint inherits its nearest retained anatomical joint.
    indices={bone:i for i,bone in enumerate(source_bones)}
    weights=np.zeros((n,len(indices)))
    for bone,entries in json.loads((source/'default_weights.mhw').read_text())['weights'].items():
        while bone and bone not in indices:
            bone=skel['bones'][bone]['parent']
        for i,w in entries:weights[i,indices.get(bone,0)]+=w
    total=weights.sum(axis=1)
    weights[total<.001,0]=1
    return weights/weights.sum(axis=1,keepdims=True)


def build_boxer(source, collection):
    source=Path(source)
    label='Challenger'
    rigdata=json.loads((source/'default.mhskel').read_text())
    base,uv,faces=read_obj(source/'base.obj')
    shaped=base.copy()
    morphs=[('african-male-young',1),('universal-male-young-maxmuscle-averageweight',.86)]
    for name,strength in morphs:
        deltas=np.loadtxt(source/(name+'.target'))
        shaped[deltas[:,0].astype(int)]+=strength*deltas[:,1:]
    bodyFaces=[corners for g,corners in faces if g=='body']
    ids=np.unique([c[0] for f in bodyFaces for c in f])
    low,high=np.min(shaped[ids,1]),np.max(shaped[ids,1])
    scale=1.84/(high-low)
    def meters(v): return (v-np.array([0,low,0]))*scale
    rest=meters(shaped)

    def joint(name):
        idx=rigdata['joints'][rigdata['bones'][name]['head']]
        return rest[idx].mean(axis=0)
    names=['Root','DriveL','ForeL','DriveR','ForeR']
    source_bones=['root','upperarm01.R','lowerarm01.R','upperarm01.L','lowerarm01.L']
    parents=[None,'Chest','DriveL','Chest','DriveR']
    origins=[np.array([0.,.91,0.])]
    transforms=[(np.eye(3),np.zeros(3))]
    wrists=[]
    for side,letter in [(-1,'R'),(1,'L')]:
        shoulder=joint('upperarm01.'+letter); elbow=joint('lowerarm01.'+letter);wrist=joint('wrist.'+letter)
        def along(a,b): return np.array(Vector(a).normalized().rotation_difference(Vector(b).normalized()).to_matrix())
        u=np.array([side*.40,-.92,.20])
        l=np.array([-side*.38,.76,.53])
        ru=along(elbow-shoulder,u); rl=along(wrist-elbow,l)
        bent_elbow=shoulder+ru@(elbow-shoulder)
        bent_wrist=bent_elbow+rl@(wrist-elbow)
        origins.extend([shoulder,bent_elbow]);wrists.append(bent_wrist)
        transforms.extend([(ru,shoulder-ru@shoulder),(rl,bent_elbow-rl@elbow)])
    for name,src,parent in [('Chest','spine03','Root'),('Head','neck01','Chest'),
                             ('ThighL','upperleg01.R','Root'),('ShinL','lowerleg01.R','ThighL'),('FootL','foot.R','ShinL'),
                             ('ThighR','upperleg01.L','Root'),('ShinR','lowerleg01.L','ThighR'),('FootR','foot.L','ShinR')]:
        names.append(name);source_bones.append(src);parents.append(parent)
        origins.append(joint(src));transforms.append((np.eye(3),np.zeros(3)))
    weights=component_weights(source,rigdata,len(rest),source_bones)
    def posed(v,w):
        return sum((v@rot.T+offset)*w[:,i:i+1] for i,(rot,offset) in enumerate(transforms))
    rig=bpy.data.armatures.new(label+' skeleton')
    arm=bpy.data.objects.new(label+'Rig',rig);collection.objects.link(arm)
    bpy.context.view_layer.objects.active=arm;arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for i,(name,point) in enumerate(zip(names,origins)):
        b=rig.edit_bones.new(name);b.head=to_blender(point)
        b.tail=b.head+Vector((0,0,.09))
    for name,parent in zip(names,parents):
        if parent:rig.edit_bones[name].parent=rig.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    skin=texture(label+' complexion',source/'young_darkskinned_male_diffuse.jpg')
    eye=texture(label+' iris',source/'eyes.jpg')
    solids={k:bpy.data.materials[k] for k in ['trunks','paper','black','thread','oxblood','trouser','linen','inkhide']}
    def part(name,coords,w,uvs,polys):
        # Drop unused helper and occluded vertices before GLB export.
        used=sorted({idx for corners,m in polys for idx,_ in corners})
        remap={v:i for i,v in enumerate(used)}
        mesh=bpy.data.meshes.new(label+' '+name)
        mesh.from_pydata([to_blender(p) for p in posed(coords[used],w[used])],[],
                          [[remap[i] for i,_ in f] for f,m in polys])
        mats=list(dict.fromkeys(m for f,m in polys))
        for m in mats:mesh.materials.append(m)
        uv_layer=mesh.uv_layers.new(name='UVMap')
        for p,(f,m) in zip(mesh.polygons,polys):
            p.material_index=mats.index(m);p.use_smooth=True
            for loop,(_,uv_id) in zip(p.loop_indices,f):uv_layer.data[loop].uv=uvs[uv_id]
        obj=bpy.data.objects.new(mesh.name,mesh);collection.objects.link(obj);obj.parent=arm
        mod=obj.modifiers.new('Deform','ARMATURE');mod.object=arm
        groups=[obj.vertex_groups.new(name=n) for n in names]
        for dest,idx in enumerate(used):
            for n,weight in enumerate(w[idx]):
                if weight>.0001:groups[n].add([dest],float(weight),'REPLACE')
        return obj
    def fitted(name):
        v,uvs,fs=read_obj(source/(name+'.obj'));text=(source/(name+'.mhclo')).read_text()
        raw=text.split('verts 0',1)[1].strip().splitlines()[:len(v)]
        axis_scale=[]
        for axis,key in enumerate(['x','y','z']):
            a,b,length=re.search(key+r'_scale\s+(\d+)\s+(\d+)\s+([\d.]+)',text).groups()
            axis_scale.append(abs(shaped[int(a),axis]-shaped[int(b),axis])/float(length))
        blend=[];coords=[]
        for i,line in enumerate(raw):
            values=line.split()
            refs=[int(values[0])] if len(values)==1 else list(map(int,values[:3]))
            bary=np.array([1.] if len(values)==1 else list(map(float,values[3:6])))
            offset=np.array(list(map(float,values[6:9])))*axis_scale if len(values)>6 else 0
            coords.append(shaped[refs].T@bary+offset)
            blend.append(weights[refs].T@bary)
        deleted=set()
        if 'delete_verts' in text:
            for a,b in re.findall(r'(\d+)(?:\s*-\s*(\d+))?',text.split('delete_verts',1)[1]):
                deleted.update(range(int(a),int(b or a)+1))
        return meters(np.array(coords)),np.array(blend),uvs,[f for g,f in fs],deleted

    clothes,cw,cu,cf,_=fitted('male_casualsuit04')
    garment=[(f,solids['trunks']) for f in cf if f[0][0]>=810 and max(clothes[i,1] for i,_ in f)>=.616]
    clothes[810:,1]=np.maximum(clothes[810:,1],.616)
    part('kit',clothes,cw,cu,garment)
    hidden_hand=np.zeros(len(rest),dtype=bool)
    for letter in ('L','R'):
        wrist=joint('wrist.'+letter)
        direction=wrist-joint('lowerarm01.'+letter)
        direction/=np.linalg.norm(direction)
        hidden_hand|=((rest-wrist)@direction>-.013)&(np.abs(rest[:,0])>abs(wrist[0])-.07)
    visible=[]
    for f in bodyFaces:
        idx=[i for i,_ in f]
        x,y,z=rest[idx].mean(0)
        if y<.19 or (.625<y<1.05 and abs(x)<.31) or hidden_hand[idx].all():continue
        visible.append((f,skin))
    part('body',rest,weights,uv,visible)
    eyes,ew,eu,ef,_=fitted('low-poly')
    part('eyes',eyes,ew,eu,[(f,eye) for f in ef])
    def accessory(obj,name,location,bone):
        # Parent inverse retains the mesh orientation in the rig's rest pose.
        collection.objects.link(obj);obj.name=label+' '+name
        obj.parent=arm;obj.parent_type='BONE';obj.parent_bone=bone
        bpy.context.view_layer.update()
        obj.matrix_world=Matrix.Translation(Vector(to_blender(location)))
        return obj
    template=next(o for o in bpy.data.objects if o.type=='MESH' and o.name=='Hand')
    for side,wrist,elbow in zip([-1,1],wrists,[origins[2],origins[4]]):
        glove=template.copy();glove.data=template.data.copy()
        for slot in glove.material_slots:
            if slot.material and slot.material.name.startswith('inkhide'):slot.material=solids['oxblood']
        direction=wrist-elbow
        direction/=np.linalg.norm(direction)
        center=wrist+direction*.071
        accessory(glove,'glove',center,'ForeL' if side<0 else 'ForeR')
        # Centre the wrist inside the cuff and point the fist along the forearm.
        rotation=Vector((0,0,1)).rotation_difference(Vector(to_blender(direction)))
        glove.matrix_world=Matrix.Translation(Vector(to_blender(center)))@rotation.to_matrix().to_4x4()
        if side<0:glove.data.transform(Matrix.Diagonal((-1,1,1,1)));glove.data.flip_normals()
    def trim(name, rings, material, bone='Root'):
        pts=[]; polys=[];segments=36
        for x,y,z,a,b in rings:
            pts.extend([(x+a*cos(2*pi*i/segments),y,z+b*sin(2*pi*i/segments)) for i in range(segments)])
        for row in range(len(rings)-1):
            for i in range(segments):
                a=row*segments+i;b=row*segments+(i+1)%segments
                polys.append((a,a+segments,b+segments,b))
        polys.extend([tuple(range(segments)),tuple(reversed(range(len(pts)-segments,len(pts))))])
        mesh=bpy.data.meshes.new(label+' '+name);mesh.from_pydata(list(map(to_blender,pts)),[],polys);mesh.materials.append(solids[material])
        for face in mesh.polygons:face.use_smooth=True
        obj=bpy.data.objects.new(mesh.name,mesh);accessory(obj,name,(0,0,0),bone)
    band=clothes[810:][clothes[810:,1]>clothes[810:,1].max()-.075]
    x0,y0,z0=band.min(axis=0);x1,y1,z1=band.max(axis=0)
    center=(z0+z1)/2;a=max(.14,(x1-x0)/2+.008);b=(z1-z0)/2+.011
    trim('championship waistband',[(0,y1-.073,center,a+.012,b+.007),(0,y1-.048,center,a+.006,b+.005),(0,y1+.003,center,a,b)],'thread')
    for side,letter in [(-1,'R'),(1,'L')]:
        ankle=joint('foot.'+letter);x,_,z=ankle; bone='FootL' if side<0 else 'FootR'
        trim('boxing boot',[(x,.012,z+.057,.060,.133),(x,.032,z+.057,.063,.137),(x,.066,z+.053,.061,.124),
                            (x,.101,z+.025,.054,.092),(x,.15,z,.049,.065),(x,.219,z,.054,.060)] ,'inkhide',bone)
        trim('sole',[(x,.009,z+.057,.061,.135),(x,.025,z+.057,.064,.139)] ,'linen',bone)
        for h in [.155,.176,.197]:
            trim('boot band',[(x,h,z,.054,.063),(x,h+.006,z,.054,.063)],'thread',bone)
    footwork=runpy.run_path(str(Path(__file__).with_name('footwork.py')))
    footwork['animate_guard'](arm,bpy.context.scene)
    return arm
