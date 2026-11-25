"""Build in a dedicated scene. Run with Blender --background --python build.py."""
from pathlib import Path
from math import sin, cos, pi, sqrt
import bpy
import bmesh
from mathutils import Vector

OUT = Path(__file__).resolve().parents[1] / "assets"
OUT.mkdir(exist_ok=True)
previous = bpy.context.window.scene
scene = bpy.data.scenes.new("FairPlay · producción")
bpy.context.window.scene = scene
materials = {}
pieces = {}
roots = []
exports = {}


def material(name, color, metal=0, rough=.56, glow=0):
    rgb = tuple(((int(color[i:i+2], 16)/255 + .055)/1.055)**2.4 for i in (0, 2, 4)) + (1,)
    m = bpy.data.materials.new(name)
    m.diffuse_color = rgb
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    for key, value in [("Base Color", rgb), ("Metallic", metal), ("Roughness", rough),
                       ("Emission Color", rgb), ("Emission Strength", glow)]:
        p.inputs[key].default_value = value
    materials[name] = m


for args in [
    ("night","17282b"), ("steel","556568",.55), ("seats","455557"), ("tread","313b3c"),
    ("canvas","739191"), ("paper","f4eedd"), ("sage","708d81"), ("black","242328"),
    ("red","a82731",.07,.33), ("leather","76222a",.12,.31), ("blue","24475d"),
    ("gold","c79a49",.65,.31), ("edge","f3d188",.45,.29),
    ("skin","ac6c4a"), ("shadow","764632"), ("hair","211b1b"), ("skin2","ce9971"),
    ("light","ffe6ba",0,.4,2), ("strip","e3a65c",0,.5,1.2)]:
    material(*args)


def geometry(group, mat, points, faces, smooth=False):
    verts, polys, mats, shading = pieces.setdefault(group, ([], [], [], []))
    offset = len(verts)
    verts.extend((x,-z,y) for x,y,z in points)
    polys.extend(tuple(offset+i for i in f) for f in faces)
    mats.extend([mat]*len(faces))
    shading.extend([smooth]*len(faces))


def box(g,m,x,y,z,w,h,d):
    points=[(x+i*w/2,y+j*h/2,z+k*d/2) for i in (-1,1) for j in (-1,1) for k in (-1,1)]
    geometry(g,m,points,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)])


def loft(g,m,levels,n=16,smooth=True):
    points=[(x+a*cos(2*pi*i/n),y,z+b*sin(2*pi*i/n)) for x,y,z,a,b in levels for i in range(n)]
    faces=[tuple(range(n)),tuple(range(len(points)-n,len(points)))]
    for row in range(len(levels)-1):
        for i in range(n):
            a=row*n+i; b=row*n+(i+1)%n
            faces.append((a,b,b+n,a+n))
    geometry(g,m,points,faces,smooth)


def oval(g,m,x,y,z,a,b,c,n=16):
    loft(g,m,[(x,y+b*sin(t*pi/12),z,a*max(.012,cos(t*pi/12)),c*max(.012,cos(t*pi/12))) for t in range(-6,7,2)],n)


def bar(g,m,start,end,r,sides=10):
    a,b=Vector(start),Vector(end)
    axis=(b-a).normalized()
    u=axis.cross(Vector((0,1,0)) if abs(axis.y)<.92 else Vector((0,0,1))).normalized()
    v=axis.cross(u)
    points=[tuple(p+r*(u*cos(i*2*pi/sides)+v*sin(i*2*pi/sides))) for p in (a,b) for i in range(sides)]
    geometry(g,m,points,[tuple(range(sides)),tuple(range(sides,2*sides))]+[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)],True)


def make_objects():
    for group,(verts,faces,mats,sm) in pieces.items():
        mesh=bpy.data.meshes.new(group)
        mesh.from_pydata(verts,[],faces)
        slots=list(dict.fromkeys(mats))
        for mat in slots: mesh.materials.append(materials[mat])
        for p,m,s in zip(mesh.polygons,mats,sm):
            p.material_index=slots.index(m); p.use_smooth=s
        bm=bmesh.new(); bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
        bm.to_mesh(mesh); bm.free()
        obj=bpy.data.objects.new(group,mesh); scene.collection.objects.link(obj); roots.append(obj)
    pieces.clear()


def export(name):
    make_objects()
    bpy.ops.object.select_all(action='DESELECT')
    for obj in roots: obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+".glb")),export_format="GLB",use_selection=True,use_active_scene=True,export_yup=True)
    exports[name] = list(roots)
    for obj in roots: obj.hide_set(True)
    roots.clear(); pieces.clear()


def glove(g,x,y,z,color):
    loft(g,"black",[(x,y-.13,z,.08,.068),(x,y-.04,z,.088,.081)])
    loft(g,"paper",[(x,y-.105,z,.081,.071),(x,y-.089,z,.083,.074)])
    loft(g,color,[(x,y-.048,z,.084,.082),(x,y+.025,z+.007,.111,.105),
                   (x,y+.105,z+.017,.112,.091),(x,y+.147,z+.01,.078,.065),
                   (x,y+.157,z,.044,.045)])
    oval(g,color,x-.082,y+.012,z+.035,.045,.07,.053)


def human(ref=False):
    body="Official" if ref else "Boxer"
    skin="skin2" if ref else "skin"
    top="paper" if ref else skin
    for sign in (-1,1):
        x=sign*.14; z=sign*.092
        oval(body,"black",x,.071,z+.046,.097,.075,.154)
        bar(body,"black" if ref else "paper",(x,.13,z),(x,.31,z),.074)
        bar(body,"black" if ref else skin,(x,.28,z),(x*1.08,.62,z+.018),.079)
        oval(body,"black" if ref else "red",x,.732,z*.5,.137,.235,.146)
    loft(body,"black" if ref else "red",[(0,.69,0,.244,.156),(0,.88,0,.224,.157),(0,.97,0,.203,.138)])
    loft(body,"black" if ref else "paper",[(0,.906,0,.216,.152),(0,.982,0,.208,.141)])
    loft(body,top,[(0,.973,0,.20,.136),(0,1.13,0,.218,.15),(0,1.36,0,.302,.177),(0,1.45,0,.279,.147),(0,1.49,0,.173,.12)])
    bar(body,skin,(0,1.45,0),(0,1.59,0),.091)
    loft(body,skin,[(0,1.53,.042,.064,.074),(0,1.58,.027,.106,.114),(0,1.66,.01,.128,.134),(0,1.76,0,.128,.12),(0,1.82,0,.094,.095)])
    loft(body,"hair",[(0,1.741,-.013,.131,.118),(0,1.806,-.012,.123,.113),(0,1.85,-.013,.073,.071)])
    oval(body,skin,0,1.674,.125,.027,.041,.032)
    for sign in (-1,1):
        oval(body,skin,sign*.125,1.676,0,.026,.046,.029)
        bar(body,"hair",(sign*.025,1.719,.122),(sign*.079,1.715,.105),.009)
        oval(body,"black",sign*.055,1.698,.121,.009,.006,.006)
        arm=("Ref" if ref else "Fist")+("L" if sign<0 else "R")
        shoulder=(sign*.27,1.405,0); elbow=(sign*.362,1.157,.083)
        hand=(sign*(.37 if ref else .229),1.01 if ref else 1.46,.14 if ref else .284)
        oval(arm,top,*shoulder,.124,.116,.119)
        bar(arm,top,shoulder,elbow,.086); oval(arm,skin,*elbow,.08,.08,.08)
        bar(arm,skin,elbow,hand,.069)
        if ref: oval(arm,skin,*hand,.07,.089,.051)
        else: glove(arm,*hand,"red")
    if ref: box(body,"black",0,1.425,.157,.106,.044,.027)
    export("referee" if ref else "opponent")


def venue_details():
    for i in range(32):
        a=i*2*pi/32; b=(i+1)*2*pi/32
        for y,r in [(4.18,16.94),(8.8,16.94),(10.1,10.2)]:
            bar("Canopy","steel",(r*cos(a),y,r*sin(a)),(r*cos(b),y,r*sin(b)),.085)
        if i%2==0:
            bar("Canopy","steel",(16.94*cos(a),4.18,16.94*sin(a)),(16.94*cos(a),8.8,16.94*sin(a)),.105)
            bar("Canopy","steel",(16.94*cos(a),8.8,16.94*sin(a)),(7.2*cos(a),10.8,7.2*sin(a)),.10)
        bar("Ribbon","strip",(15.1*cos(a),3.39,15.1*sin(a)),(15.1*cos(b),3.39,15.1*sin(b)),.055)
    for x in (-1,1):
        bar("Frame","steel",(x*3.55,1.68,-8.28),(x*3.55,5.0,-8.28),.065)
    for i in range(4):
        a=i*pi/2
        for v in (-2.65,2.65):
            x=8.24*sin(a)+v*cos(a); z=-8.24*cos(a)+v*sin(a)
            bar("Frame","steel",(x,4.74,z),(x,8.8,z),.043)


def fan_details():
    for s in (-1,1):
        bar("FanDetails","sage",(s*.168,.6,0),(s*.24,.34,.08),.064,8)
        bar("FanDetails","skin2",(s*.24,.34,.08),(s*.16,.32,.225),.045,8)
        bar("FanDetails","night",(s*.095,.23,.02),(s*.13,.20,.27),.083,8)
        bar("FanDetails","night",(s*.13,.20,.27),(s*.13,-.06,.27),.058,8)
        oval("FanDetails","black",s*.13,-.075,.316,.067,.053,.094,8)
    oval("FanDetails","hair",0,.978,-.014,.13,.071,.13,8)


human(); human(True)
glove("Hand",0,0,0,"red"); export("glove")
loft("Belt","leather",[(0,-.097,0,.325,.159),(0,.10,0,.325,.159)],32)
for x,width in [(0,.172),(-.231,.071),(.231,.071)]:
    oval("Belt","gold",x,0,.135,width,width*.81,.045,12)
    oval("Belt","edge",x,0,.171,width*.79,width*.65,.019,12)
    oval("Belt","gold",x,0,.19,width*.53,width*.47,.009,8)
export("belt")

# Boxing canvas at world height zero. The front ropes have an entrance gate.
box("Ring","night",0,-.46,0,6.8,.86,6.8); box("Ring","canvas",0,-.025,0,6.74,.05,6.74)
for x in (-3.24,3.24):
    for z in (-3.24,3.24):
        col="red" if x*z>0 else "blue"
        bar("Ring","steel",(x,-.15,z),(x,1.43,z),.076)
        loft("Ring",col,[(x,.35,z,.124,.124),(x,1.32,z,.127,.127),(x,1.36,z,.095,.095)],12)
for i,h in enumerate((.4,.68,.96,1.23)):
    col=("blue","paper","paper","red")[i]
    for s in (-3.24,3.24): bar("Ring",col,(s,h,-3.24),(s,h,3.24),.025)
    bar("Ring",col,(-3.24,h,-3.24),(3.24,h,-3.24),.025)
    for sign in (-1,1): bar("Ring",col,(sign*.85,h,3.24),(sign*3.24,h,3.24),.025)
    bar("Gate",col,(-.85,h,3.24),(.85,h,3.24),.025)
box("Floor","night",0,-1.06,0,59,.32,59)
box("Walkway","tread",0,-.12,9,2.7,.2,12)
for sign in (-1,1):
    box("Tunnel","night",sign*1.6,1.36,11,.28,3.4,8)
    box("Tunnel","strip",sign*1.447,.12,11,.032,.046,8)
box("Tunnel","night",0,3.05,11,3.48,.22,8)
for z in (7.25,9.3,11.35,13.4):
    box("Tunnel","light",0,2.92,z,2.83,.03,.085)
for s in (-1,1):
    box("DoorL" if s<0 else "DoorR","steel",s*.73,1.41,7.0,1.46,2.84,.18)
    box("DoorL" if s<0 else "DoorR","strip",s*.08,1.41,7.11,.036,2.52,.03)
for row in range(7):
    r=8+row*1.28; h=-.6+row*.68
    for sector in range(32):
        a=sector*2*pi/32; b=(sector+1)*2*pi/32
        if min(abs(a-pi/2),abs(b-pi/2))<.16: continue
        geometry("Terraces","seats",[(d*cos(t),y,d*sin(t)) for d,y in [(r,h),(r+1.3,h),(r,h-.68)] for t in (a,b)],[(0,1,3,2),(0,4,5,1)])
for i in range(24):
    a=i*2*pi/24;b=(i+1)*2*pi/24
    for y in (7.3,7.67):
        bar("Truss","steel",(12*cos(a),y,12*sin(a)),(12*cos(b),y,12*sin(b)),.052)
    bar("Truss","steel",(12*cos(a),7.3,12*sin(a)),(12*cos(b),7.67,12*sin(b)),.038)
    for k in (-.065,0,.065):
        x=12*cos(a+k);z=12*sin(a+k)
        oval("Lamps","light",x,7.18,z,.18,.083,.18,8)
venue_details()
export("arena")
oval("Fan","sage",0,.44,0,.21,.33,.14,8)
oval("Fan","skin2",0,.88,0,.127,.16,.128,8)
fan_details()
export("spectator")
# Assemble an editable overview alongside the individual web exports.
for name, objects in exports.items():
    collection=bpy.data.collections.new("FP / "+name)
    scene.collection.children.link(collection)
    for obj in objects:
        obj.hide_set(False)
        collection.objects.link(obj)
        scene.collection.objects.unlink(obj)
        if name=="referee": obj.location=(1.65,1.1,0)
        elif name=="opponent": obj.location=(0,.45,0)
        elif name=="belt": obj.location=(1.1,-1.0,1.1)
        elif name=="glove": obj.location=(-.5,-1.1,1.15)
        elif name=="spectator": obj.location=(8.4,0,-.58)
for area in bpy.context.screen.areas:
    if area.type=="VIEW_3D":
        space=area.spaces.active
        space.shading.color_type='MATERIAL'
        space.overlay.show_overlays=False
        space.region_3d.view_rotation=Vector((-5.5,8,-3.8)).to_track_quat('-Z','Y')
        space.region_3d.view_location=(0,0,.65)
        space.region_3d.view_distance=9.2
if bpy.app.background: bpy.context.window.scene=previous
