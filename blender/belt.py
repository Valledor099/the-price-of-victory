"""Championship belt in game coordinates, facing +Z toward the player."""
from math import cos, sin, pi
import bpy


def championship_belt(geometry, scene):
    group = "FairPlay championship belt"

    def depth(x):
        # The flexible ends wrap away from the medal and toward the wearer's waist.
        return -.69 * x * x

    def skin(material, points, faces):
        geometry(group, material, [(x, y, z + depth(x)) for x, y, z in points], faces)

    def plate(outline, material, base, height, bevel=.05):
        cx = sum(x for x, y in outline) / len(outline)
        cy = sum(y for x, y in outline) / len(outline)
        points = []
        for z, scale in [(base, 1-bevel), (base+height*.26, 1), (base+height*.74, 1), (base+height, 1-bevel)]:
            points.extend((cx+(x-cx)*scale, cy+(y-cy)*scale, z) for x, y in outline)
        n = len(outline)
        faces = [tuple(reversed(range(n))), tuple(range(n*3, n*4))]
        faces.extend((row*n+i, row*n+(i+1)%n, (row+1)*n+(i+1)%n, (row+1)*n+i)
                     for row in range(3) for i in range(n))
        skin(material, points, faces)

    def ellipse(x, y, w, h, n=24):
        return [(x+w*cos(i*2*pi/n), y+h*sin(i*2*pi/n)) for i in range(n)]

    def star(x, y, r):
        return [(x+sin(pi*i/5)*r*(.45 if i%2 else 1), y+cos(pi*i/5)*r*(.45 if i%2 else 1)) for i in range(10)]

    def legend(body, y, size, width):
        curve = bpy.data.curves.new("Die lettering", "FONT")
        curve.body, curve.size = body, size
        curve.align_x, curve.align_y = 'CENTER', 'CENTER'
        curve.space_character, curve.extrude, curve.resolution_u = 1.12, .00065, 5
        stamp = bpy.data.objects.new("Lettering die", curve)
        scene.collection.objects.link(stamp)
        deps = bpy.context.evaluated_depsgraph_get()
        evaluated = stamp.evaluated_get(deps)
        mesh = evaluated.to_mesh()
        coords = [v.co for v in mesh.vertices]
        factor = width / (max(p.x for p in coords)-min(p.x for p in coords))
        skin("edge", [(p.x*factor, y+p.y, .046+p.z) for p in coords],
             [tuple(p.vertices) for p in mesh.polygons])
        evaluated.to_mesh_clear()
        bpy.data.objects.remove(stamp, do_unlink=True)
        bpy.data.curves.remove(curve)

    # Stitch lines follow both tapered edges of the hide, including the curved tips.
    sections = [(-.49,.029),(-.48,.052),(-.445,.060),(-.34,.066),(-.28,.078),
                (-.19,.092),(-.12,.119),(0,.126),(.12,.119),(.19,.092),
                (.28,.078),(.34,.066),(.445,.060),(.48,.052),(.49,.029)]
    points = [(x, sign*h, z) for x,h in sections for z,sign in [(-.012,-1),(-.012,1),(.006,1),(.006,-1)]]
    faces = [(0,1,2,3),tuple(range(len(points)-4,len(points)))]
    faces.extend((4*i+j,4*i+(j+1)%4,4*i+4+(j+1)%4,4*i+4+j) for i in range(len(sections)-1) for j in range(4))
    skin("inkhide",points,faces)
    for (ax,ah),(bx,bh) in zip(sections,sections[1:]):
        count = max(1,round((bx-ax)/.015))
        for i in range(count):
            x = ax+(bx-ax)*(i+.5)/count
            h = ah+(bh-ah)*(i+.5)/count-.007
            for s in (-1,1):
                plate(ellipse(x,s*h,.0048,.0012,8),"thread",.006,.0009)
    # Layered, scalloped medal with a polished edge and enamel inlay.
    half = [(0,.143),(.067,.137),(.087,.117),(.130,.107),(.141,.076),
            (.174,.066),(.181,.029),(.174,-.064),(.133,-.075),(.110,-.105),(.056,-.123),(0,-.139)]
    crest = half+[(-x,y) for x,y in reversed(half[1:-1])]
    for scale,mat,z,h in [(1,"gold",.007,.017),(.96,"edge",.021,.008),(.916,"gold",.028,.006),(.858,"trunks",.033,.006)]:
        plate([(x*scale,y*scale) for x,y in crest],mat,z,h,.035)
    for s in (-1,1):
        cx = .258*s
        for scale,mat,z,h in [(1,"gold",.007,.014),(.91,"edge",.02,.006),(.78,"trunks",.026,.005)]:
            outline = [(cx+s*x*scale,y*scale) for x,y in [(-.058,.048),(-.037,.067),(.034,.061),(.056,.037),(.049,-.041),(.025,-.061),(-.040,-.063),(-.058,-.039)]]
            plate(outline,mat,z,h)
        plate(star(cx,0,.033),"edge",.031,.006)
        for x in (.363,.420):
            for y in (-.027,.027):
                plate(ellipse(s*x,y,.012,.011,14),"gold",.006,.006,.12)
                plate(ellipse(s*x,y,.0065,.006,12),"trim",.012,.001)
        # Branches of chased laurel flank the enamel face.
        for i in range(7):
            t=i/6
            x=s*(.057+.084*t)
            y=-.080+.098*t*t
            plate([(x-s*.010,y-.001),(x-s*.002,y+.006),(x+s*.006,y+.018),(x+s*.005,y+.003)],"gold",.039,.003)
    # Raised FP monogram traced from the school's FairPlay mark.
    mark = [[(18,72),(61,0),(179,0),(150,24),(74,24)],
            [(0,103),(43,67),(70,38),(137,38),(112,62),(55,62),(31,103)],
            [(28,139),(90,81),(124,81),(137,73),(121,49),(144,30),(162,40),(172,55),
             (173,72),(166,89),(150,100),(131,104),(76,104),(55,139)]]
    for outline,mat in zip(mark,["paper","edge","sage"]):
        plate([((x-90)*.00068,.021+(70-y)*.00064) for x,y in outline],mat,.039,.006,.018)
    legend("FAIR PLAY",.091,.022,.101)
    legend("CAMPEÓN",-.051,.030,.149)
    plate(star(0,-.090,.013),"edge",.039,.006)
