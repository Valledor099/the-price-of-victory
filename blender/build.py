"""Build in a dedicated scene. Run with Blender --background --python build.py."""
from pathlib import Path
from math import sin, cos, pi, sqrt
import bpy
import bmesh
import runpy
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
    ("oxblood","842936",.08,.37), ("inkhide","244448",.09,.38), ("thread","cdad74",.13,.48),
    ("trim","473533",.04,.55), ("iris","372a27"), ("lip","92584d"), ("linen","cad3cb"),
    ("trunks","203c42",.14,.48), ("trouser","333c42"), ("light","ffe6ba",0,.4,2), ("strip","e3a65c",0,.5,1.2)]:
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
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+".glb")),export_format="GLB",use_selection=True,use_active_scene=True,export_yup=True,
        export_animation_mode="NLA_TRACKS",export_frame_range=False)
    exports[name] = list(roots)
    for obj in roots: obj.hide_set(True)
    roots.clear(); pieces.clear()


def contour(g, mat, points, radius):
    for a, b in zip(points, points[1:]):
        bar(g, mat, a, b, radius, 7)


def glove(g,x,y,z,color,side=1):
    # Sculpted cross sections, broad over the knuckles and tapered into the wrist.
    # Front is the back of the fist. The tucked fingers and thumb meet on the palm.
    def pad(mat,rows,power=.83):
        rings=[]
        for i in range(len(rows)-1):
            a,b,c,d=[rows[max(0,min(len(rows)-1,j))] for j in (i-1,i,i+1,i+2)]
            for step in range(3):
                t=step/3
                rings.append([.5*((2*q)+(-p+r)*t+(2*p-5*q+4*r-s)*t*t+(-p+3*q-3*r+s)*t**3)
                              for p,q,r,s in zip(a,b,c,d)])
        rings.append(rows[-1])
        points=[];n=32
        for h,dx,dz,width,depth in rings:
            for j in range(n):
                a=2*pi*j/n;u,v=cos(a),sin(a)
                points.append((x+side*(dx+width*(1 if u>=0 else -1)*abs(u)**power),
                               y+h,z+dz+depth*(1 if v>=0 else -1)*abs(v)**power))
        faces=[tuple(reversed(range(n))),tuple(range(len(points)-n,len(points)))]
        for i in range(len(rings)-1):
            for j in range(n):
                a=i*n+j;b=i*n+(j+1)%n;faces.append((a,b,b+n,a+n))
        geometry(g,mat,points,faces,True)
    pad("black",[(-.139,0,0,.055,.046),(-.134,0,0,.063,.053),(-.054,0,0,.070,.055)])
    pad(color,[(-.134,0,.001,.062,.051),(-.127,0,.001,.066,.056),(-.079,.002,.002,.073,.060),
               (-.049,.003,.004,.077,.059),(-.045,.003,.006,.073,.054)],.76)
    pad("trim",[(-.129,0,.001,.065,.055),(-.126,0,.001,.067,.057),(-.123,0,.001,.066,.056)])
    pad(color,[(-.072,.002,.007,.060,.045),(-.041,.005,.012,.073,.054),(.008,.009,.014,.081,.065),
               (.066,.012,.014,.089,.073),(.105,.011,.009,.093,.079),(.129,.009,-.003,.088,.078),
               (.150,.007,-.012,.070,.062),(.161,.004,-.014,.037,.031),(.163,.003,-.014,.009,.008)])
    pad(color,[(.002,.008,-.033,.046,.020),(.017,.009,-.042,.066,.026),(.038,.010,-.049,.073,.028),
               (.062,.010,-.053,.077,.027),(.079,.012,-.052,.071,.023),(.083,.010,-.051,.055,.010)])
    pad(color,[(-.053,-.047,-.008,.023,.020),(-.029,-.068,-.016,.035,.029),
               (.007,-.079,-.030,.037,.033),(.036,-.075,-.046,.034,.031),
               (.054,-.063,-.057,.027,.025),(.064,-.047,-.059,.012,.014)],.93)
    def line(mat,points,r):
        contour(g,mat,[(x+side*a,y+b,z+c) for a,b,c in points],r)
    line("trim",[(-.096,-.003,-.033),(-.098,.018,-.043),(-.085,.041,-.061),(-.063,.056,-.073),(-.046,.061,-.070)],.0022)
    line("trim",[(-.051,.019,-.060),(-.028,.012,-.065),(.006,.011,-.067),(.043,.014,-.066),(.064,.021,-.060)],.002)
    # Raised wrap strap, double stitching and the angular FairPlay monogram.
    for h in (-.114,-.072):
        line("thread",[(-.059,h,.042),(-.035,h,.055),(0,h,.060),(.036,h,.056),(.062,h,.040)],.0014)
    for outline in [[(-.021,-.098),(-.008,-.077),(.021,-.077),(.014,-.084),(-.004,-.084)],
                    [(-.022,-.110),(-.009,-.088),(.012,-.088),(.005,-.095),(-.007,-.095),(-.016,-.110)]]:
        geometry(g,"paper",[(x+side*a,y+b,z+.062) for a,b in outline],[tuple(range(len(outline)))])

def victory_arms():
    # Reusable segments for the first-person belt lift. Local Y spans one unit;
    # the browser fits them between the player's shoulder, elbow and glove cuff.
    for group,rows in [
        ("VictoryUpper",[(0,.059,.058),(.16,.069,.064),(.39,.073,.067),(.64,.061,.057),(.83,.048,.047),(1,.047,.046)]),
        ("VictoryForearm",[(0,.047,.045),(.10,.052,.049),(.28,.058,.054),(.48,.053,.047),(.70,.043,.038),(.87,.035,.031),(1,.032,.031)])
    ]:
        loft(group,"skin",[(0,y,0,w,h) for y,w,h in rows],24)
    loft("VictoryForearm","paper",[(0,.79,0,.041,.037),(0,.82,0,.042,.038),(0,1.02,0,.036,.034)],24)
    for h in (.84,.88,.92,.96):
        loft("VictoryForearm","linen",[(0,h,0,.0415-(h-.84)*.025,.0378-(h-.84)*.022),
                                        (0,h+.008,0,.0414-(h-.84)*.025,.0377-(h-.84)*.022)],24)


def human():
    # The .blend contains the fitted MakeHuman assets, bound muscles and packed skin maps.
    # Append the whole rig hierarchy when rebuilding in a fresh Blender session.
    name="opponent"
    source=Path(__file__).with_name("FairPlay.blend")
    with bpy.data.libraries.load(str(source),link=False) as (data,loaded):
        loaded.collections=["Athletes / "+name]
    coll=loaded.collections[0]
    scene.collection.children.link(coll)
    for obj in list(coll.objects):
        if not obj.parent: obj.location=(0,0,0)
        scene.collection.objects.link(obj);coll.objects.unlink(obj);roots.append(obj)
    export(name)


def venue_details():
    for i in range(64):
        a=i*2*pi/64; b=(i+1)*2*pi/64
        for y,r in [(14.3,40.8),(18.2,40.8),(15.1,21.0)]:
            bar("Canopy","steel",(r*cos(a),y,r*sin(a)),(r*cos(b),y,r*sin(b)),.12)
        if i%2==0:
            bar("Canopy","steel",(40.8*cos(a),13.6,40.8*sin(a)),(40.8*cos(a),18.2,40.8*sin(a)),.16)
            bar("Canopy","steel",(40.8*cos(a),18.2,40.8*sin(a)),(12*cos(a),12.4,12*sin(a)),.115)
        for y,r in [(6.48,27.6),(13.74,39.3)]:
            bar("Ribbon","strip",(r*cos(a),y,r*sin(a)),(r*cos(b),y,r*sin(b)),.06)
    for x in (-1,1):
        bar("Frame","steel",(x*3.55,1.68,-8.28),(x*3.55,5.0,-8.28),.065)
    for i in range(4):
        a=i*pi/2
        for v in (-2.65,2.65):
            x=8.24*sin(a)+v*cos(a); z=-8.24*cos(a)+v*sin(a)
            bar("Frame","steel",(x,6.38 if i==2 else 4.74,z),(x,8.8,z),.043)


def fan_details():
    for s in (-1,1):
        bar("FanDetails","sage",(s*.168,.6,0),(s*.24,.34,.08),.064,8)
        bar("FanDetails","skin2",(s*.24,.34,.08),(s*.16,.32,.225),.045,8)
        bar("FanDetails","night",(s*.095,.23,.02),(s*.13,.20,.27),.083,8)
        bar("FanDetails","night",(s*.13,.20,.27),(s*.13,-.06,.27),.058,8)
        oval("FanDetails","black",s*.13,-.075,.316,.067,.053,.094,8)
    oval("FanDetails","hair",0,.978,-.014,.13,.071,.13,8)


human()
glove("Hand",0,0,0,"inkhide"); victory_arms(); export("glove")
belt_module = runpy.run_path(str(Path(__file__).with_name("belt.py")))
belt_module["championship_belt"](geometry, scene)
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
box("Floor","night",0,-1.06,0,87,.32,87)
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
for row in range(20):
    upper=row>=10
    r=16+row*1.14+(1.5 if upper else 0); h=-.50+row*.64+(1.45 if upper else 0)
    for sector in range(64):
        a=sector*2*pi/64; b=(sector+1)*2*pi/64
        if row<10 and sin((a+b)/2)>.97:continue
        height=2.09 if row==10 else .64
        geometry("Terraces","seats",[(d*cos(t),y,d*sin(t)) for d,y in [(r,h),(r+1.15,h),(r,h-height)] for t in (a,b)],[(0,1,3,2),(0,4,5,1)])
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
        if name=="opponent" and not obj.parent: obj.location=(0,.45,0)
        elif name=="belt": obj.location=(1.1,-1.0,1.1)
        elif name=="glove":
            obj.location=(-.5,-1.1,1.15)
            if obj.name.startswith("Victory"): obj.hide_set(True);obj.hide_render=True
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
