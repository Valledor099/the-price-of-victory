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
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+".glb")),export_format="GLB",use_selection=True,use_active_scene=True,export_yup=True)
    exports[name] = list(roots)
    for obj in roots: obj.hide_set(True)
    roots.clear(); pieces.clear()


def contour(g, mat, points, radius):
    for a, b in zip(points, points[1:]):
        bar(g, mat, a, b, radius, 7)


def muscle(g, mat, start, end, profile):
    """Continuous tapered cross sections along the resting pose of a limb."""
    a,b=Vector(start),Vector(end)
    direction=(b-a).normalized()
    side=direction.cross(Vector((0,0,1))).normalized()
    depth=direction.cross(side)
    points=[]; n=18
    for t,width,thickness in profile:
        center=a.lerp(b,t)
        for i in range(n):
            ang=2*pi*i/n
            points.append(tuple(center+side*(width*cos(ang))+depth*(thickness*sin(ang))))
    faces=[tuple(range(n)),tuple(range(len(points)-n,len(points)))]
    for k in range(len(profile)-1):
        for i in range(n):
            j=(i+1)%n
            faces.append((k*n+i,k*n+j,(k+1)*n+j,(k+1)*n+i))
    geometry(g,mat,points,faces,True)


def glove(g,x,y,z,color,side=1):
    def shell(mat,rows):
        loft(g,mat,[(x+side*dx,y+h,z+dz,a,b) for h,dx,dz,a,b in rows],28)
    shell("black",[(-.153,0,-.016,.06,.057),(-.145,0,-.016,.077,.068),
                   (-.055,0,-.012,.089,.075),(-.03,0,0,.083,.07)])
    shell(color,[(-.14,0,-.016,.08,.069),(-.132,0,-.016,.083,.071),
                 (-.063,0,-.012,.092,.077),(-.055,0,-.012,.091,.076)])
    for h,r in [(-.136,.083),(-.064,.092)]:
        shell("thread",[(h,0,-.014,r,.074),(h+.003,0,-.014,r+.0005,.074)])
    shell(color,[(-.065,0,-.014,.071,.064),(-.038,.004,-.012,.085,.074),
                 (.004,.012,-.002,.097,.084),(.055,.015,.006,.105,.091),
                 (.102,.013,.012,.106,.087),(.135,.009,.013,.096,.077),
                 (.154,.008,.015,.077,.064),(.165,.005,.014,.044,.04),(.168,.004,.013,.012,.015)])
    # Attached, curved thumb and welt on both sides of the palm.
    thumb=(x-side*.066,y-.018,z+.008)
    muscle(g,color,thumb,(x-side*.082,y+.078,z+.063),
           [(0,.025,.028),(.20,.043,.039),(.55,.046,.042),(.79,.035,.034),(1,.016,.018)])
    for face in (-1,1):
        contour(g,"trim",[(x-side*.069,y-.035,z+face*.043),(x-side*.071,y+.011,z+face*.061),
                          (x-side*.051,y+.045,z+face*.078),(x-side*.022,y+.062,z+face*.085)],.0025)
        # Sewn cuff patch with twin diagonal stitch marks.
        box(g,"black",x,y-.098,z-.014+face*.073,.067,.043,.005)
        for j in (-.008,.008):
            bar(g,"thread",(x+j-.008,y-.110,z-.014+face*.077),(x+j+.008,y-.087,z-.014+face*.077),.0025,6)


def face(g,skin,official):
    # Jaw, cheeks, temples and hairline share a forward-facing profile.
    loft(g,skin,[(0,1.535,.042,.050,.058),(0,1.555,.038,.078,.085),
                 (0,1.595,.023,.101,.111),(0,1.65,.013,.119,.124),
                 (0,1.705,.004,.126,.132),(0,1.754,-.002,.124,.132),
                 (0,1.803,-.009,.101,.112),(0,1.832,-.011,.056,.071)],32)
    for side in (-1,1):
        oval(g,skin,side*.123,1.673,.004,.023,.038,.021)
        oval(g,"lip",side*.139,1.674,.013,.008,.02,.009)
        x=side*.047
        oval(g,"linen",x,1.694,.132,.022,.009,.007,20)
        oval(g,"iris",x,1.694,.139,.009,.008,.003,16)
        oval(g,"paper",x-.002,1.697,.142,.002,.002,.001,8)
        contour(g,"hair",[(side*.022,1.708,.137),(side*.048,1.719,.132),(side*.078,1.716,.115)],.0055)
        contour(g,skin,[(side*.024,1.698,.138),(side*.047,1.704,.139),(side*.068,1.697,.132)],.0028)
    loft(g,skin,[(0,1.635,.142,.021,.013),(0,1.648,.15,.027,.018),
                 (0,1.663,.15,.020,.020),(0,1.69,.132,.013,.013),(0,1.712,.128,.011,.010)])
    contour(g,"lip",[(-.039,1.603,.125),(-.017,1.608,.133),(0,1.606,.136),(.019,1.608,.132),(.039,1.605,.125)],.0036)
    loft(g,"hair",[(0,1.745,-.011,.127,.132),(0,1.777,-.01,.126,.132),
                   (0,1.814,-.01,.111,.12),(0,1.843,-.01,.079,.089),(0,1.853,-.01,.025,.036)],32)
    for side in (-1,1):
        oval(g,"hair",side*.119,1.731,-.010,.012,.032,.048)
    if official:
        for i in range(5):
            contour(g,"trim",[(-.098+.019*i,1.808,.063),(-.059+.020*i,1.839,.031),(.003+.02*i,1.837,-.034)],.004)
    else:
        for row in range(3):
            n=18-row*4
            for i in range(n):
                ang=(i+.47*row)*2*pi/n
                oval(g,"hair",(.102-row*.027)*cos(ang),1.798+row*.023,-.01+(.109-row*.025)*sin(ang),.027,.023,.027,10)


def human(ref=False):
    body="Official" if ref else "Boxer"
    skin="skin2" if ref else "skin"
    for side in (-1,1):
        x=side*(.135 if ref else .165); z=side*(.035 if ref else .125)
        foot=[(.012,.084,.141),(.026,.088,.147),(.061,.085,.143),(.096,.075,.108),(.125,.064,.075)]
        loft(body,"black",[(x,h,z+.036,a,b) for h,a,b in foot],22)
        loft(body,"trouser" if ref else "linen",[(x,.014,z+.037,.085,.144),(x,.029,z+.037,.089,.149)],22)
        if ref:
            loft(body,"trouser",[(x,.095,z,.079,.095),(x,.22,z,.078,.081),(x,.45,z,.086,.083),
                                 (x,.53,z,.092,.097),(side*.12,.76,0,.114,.135),(side*.104,.91,0,.115,.13)],22)
        else:
            muscle(body,skin,(x,.17,z),(x,.65,z*.72),[(0,.048,.052),(.29,.059,.068),(.53,.079,.088),(.72,.073,.081),(1,.084,.088)])
            loft(body,"trunks",[(x,.086,z,.074,.093),(x,.174,z,.065,.071),(x,.267,z,.062,.063)],20)
            for h in (.242,.255):
                loft(body,"thread",[(x,h,z,.064,.065),(x,h+.005,z,.064,.065)],20)
            for i in range(4):
                bar(body,"linen",(x-.029,.098+i*.021,z+.086-i*.006),(x+.029,.105+i*.021,z+.086-i*.006),.0028,6)
            loft(body,"trunks",[(x,.57,z*.56,.116,.138),(x,.612,z*.55,.123,.144),
                                (side*.126,.77,z*.28,.131,.149),(side*.104,.894,0,.119,.142)],24)
            loft(body,"thread",[(x,.578,z*.56,.118,.140),(x,.591,z*.56,.121,.143)],24)
    loft(body,"trouser" if ref else "trunks",[(0,.75,0,.211,.143),(0,.834,0,.225,.155),(0,.95,0,.195,.135)],26)
    loft(body,"black" if ref else "thread",[(0,.898,0,.21,.147),(0,.915,0,.212,.149),(0,.961,0,.198,.14)],26)
    box(body,"steel" if ref else "trunks",0,.933,.145,.061,.03,.008)
    top="paper" if ref else skin
    loft(body,top,[(0,.956,0,.194,.135),(0,1.053,-.005,.191,.142),(0,1.155,-.01,.206,.148),
                   (0,1.239,0,.241,.164),(0,1.329,.008,.271,.18),(0,1.393,.005,.287,.17),
                   (0,1.439,-.006,.259,.147),(0,1.484,-.012,.146,.119),(0,1.496,0,.099,.09)],30)
    loft(body,skin,[(0,1.454,0,.113,.10),(0,1.51,0,.089,.08),(0,1.587,.013,.084,.08)])
    if ref:
        for side in (-1,1):
            geometry(body,"linen",[(0,1.475,.092),(side*.097,1.485,.066),(side*.070,1.393,.162),(0,1.434,.147)],[(0,1,2,3)])
            oval(body,"black",side*.026,1.433,.157,.031,.019,.009,14)
        contour(body,"linen",[(0,.97,.137),(0,1.16,.144),(0,1.327,.189),(0,1.413,.162)],.005)
        for y,z in [(1.04,.143),(1.15,.149),(1.24,.166),(1.34,.191)]:
            oval(body,"black",0,y,z,.005,.005,.003,8)
        box(body,"linen",.131,1.323,.158,.084,.065,.010)
        box(body,"trunks",.131,1.337,.165,.057,.022,.006)
    else:
        for side in (-1,1):
            oval(body,skin,side*.123,1.339,.132,.132,.081,.053,24)
            contour(body,skin,[(side*.044,1.432,.151),(side*.109,1.443,.138),(side*.197,1.43,.107)],.011)
    face(body,skin,ref)
    for side in (-1,1):
        arm=("Ref" if ref else "Fist")+("L" if side<0 else "R")
        shoulder=(side*.255,1.397,0)
        elbow=(side*(.335 if ref else .357),1.147,.068)
        hand=(side*(.33 if ref else .212),.961 if ref else (1.446+side*.035),.12 if ref else (.291+side*.047))
        muscle(arm,top,shoulder,elbow,[(0,.081,.082),(.14,.111,.116),(.35,.102,.107),(.62,.082,.087),(.85,.073,.076),(1,.068,.069)])
        oval(arm,skin,*elbow,.068,.070,.064)
        muscle(arm,skin,elbow,hand,[(0,.064,.061),(.22,.078,.073),(.51,.068,.061),(.82,.047,.043),(1,.044,.043)])
        if ref:
            muscle(arm,"linen",shoulder,elbow,[(.67,.084,.088),(.72,.083,.086)])
            oval(arm,skin,*hand,.052,.065,.032)
            for j in range(4):
                finger=(hand[0]+side*(j-1.5)*.021,hand[1]-.041,hand[2]+.004)
                oval(arm,skin,*finger,.011,.044-.006*abs(j-1),.012,12)
            oval(arm,skin,hand[0]-side*.046,hand[1]-.006,hand[2]+.014,.016,.039,.017,12)
        else:
            glove(arm,*hand,"oxblood",side)
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
            bar("Frame","steel",(x,6.38 if i==2 else 4.74,z),(x,8.8,z),.043)


def fan_details():
    for s in (-1,1):
        bar("FanDetails","sage",(s*.168,.6,0),(s*.24,.34,.08),.064,8)
        bar("FanDetails","skin2",(s*.24,.34,.08),(s*.16,.32,.225),.045,8)
        bar("FanDetails","night",(s*.095,.23,.02),(s*.13,.20,.27),.083,8)
        bar("FanDetails","night",(s*.13,.20,.27),(s*.13,-.06,.27),.058,8)
        oval("FanDetails","black",s*.13,-.075,.316,.067,.053,.094,8)
    oval("FanDetails","hair",0,.978,-.014,.13,.071,.13,8)


human(); human(True)
glove("Hand",0,0,0,"inkhide"); export("glove")
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
