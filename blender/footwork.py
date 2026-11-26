"""Boxer actions authored in metres in armature space (+Y in the ring is Blender Z)."""
from math import sin, cos, pi, sqrt
import bpy
from mathutils import Euler, Quaternion, Vector


def ease(x):
    x=max(0.,min(1.,x))
    return x*x*(3-2*x)


def ring(x,height,forward):
    return Vector((x,-forward,height))


def angles(pitch=0,yaw=0,roll=0):
    return Euler((pitch,-roll,yaw),'XYZ').to_quaternion()


def bend(start,end,pole,a,b):
    """Find the middle joint given the desired endpoint and natural bending plane."""
    axis=end-start
    length=max(.001,min(axis.length,a+b-.0003))
    axis.normalize()
    pole=(pole-axis*pole.dot(axis)).normalized()
    along=(a*a-b*b+length*length)/(2*length)
    return start+axis*along+pole*sqrt(max(.000001,a*a-along*along))


def animate_guard(rig,scene):
    scene.render.fps=24
    anim=rig.animation_data_create()
    anim.action=None
    for track in list(anim.nla_tracks):anim.nla_tracks.remove(track)
    joints=rig.pose.bones
    bind={b.name:b.bone.head_local.copy() for b in joints}
    orientation={b.name:b.bone.matrix_local.to_quaternion() for b in joints}
    parent_rotation={}
    def aim(name,rotation):
        parent=joints[name].parent
        relative=parent_rotation[parent.name].inverted()@rotation if parent else rotation
        basis=orientation[name]
        joints[name].rotation_quaternion=basis.inverted()@relative@basis
        joints[name].keyframe_insert(data_path='rotation_quaternion',frame=frame,group=name)
        parent_rotation[name]=rotation

    clips={'GuardFootwork':48,'StepIn':21,'StepOut':22,'CircleLeft':24,'CircleRight':24,
           'Weave':29,'LeadStraight':34,'RearCross':34,'LeadArc':34,'ReactJab':10,'ReactUppercut':15}
    stride={'StepIn':(0,.58),'StepOut':(0,-.53),'CircleLeft':(-.52,0),'CircleRight':(.52,0)}
    for name,frames in clips.items():
        action=bpy.data.actions.new(name)
        anim.action=action
        # NLA track names are the public glTF clip names, independent of Blender's ID suffixes.
        for frame in sorted(set(range(0,frames+1,2))|{frames}):
            t=frame/frames;wave=2*pi*t
            attack=name in ('LeadStraight','RearCross','LeadArc')
            active=1 if name=='RearCross' else -1
            impact=ease(t/.21)*(1-ease((t-.24)/.76))
            jab=impact if name=='ReactJab' else 0
            uppercut=impact if name=='ReactUppercut' else 0
            load=ease(t/.34)*(1-ease((t-.36)/.22)) if attack else 0
            reach=ease((t-.38)/.265)*(1-ease((t-.665)/.31)) if attack else 0
            shift=sin(wave);bob=.5-.5*cos(2*wave)
            weave=sin(wave) if name=='Weave' else 0
            moving=name in stride
            hip=ring(.036*shift+.083*weave-active*.035*load,
                     -.074-.025*bob-.075*abs(weave)-.024*load,
                     .025+.018*cos(wave)+.065*reach-.038*load-.080*uppercut-.025*jab)
            root=joints['Root']
            root.location=orientation['Root'].inverted()@hip
            root.keyframe_insert(data_path='location',frame=frame,group='Root')
            pelvis=angles(-.05,-.14+.075*shift+active*(.17*load-.32*reach),.055*shift)
            aim('Root',pelvis)
            torso=angles(.13+.06*bob+.11*abs(weave)+.11*reach-.30*uppercut,
                         -.32+.16*shift+active*(.36*load-.64*reach)+.27*jab,
                         -.11*shift-.20*weave+active*.09*reach)
            aim('Chest',torso)
            aim('Head',angles(.085+.045*bob-.40*uppercut,-.03+.06*shift+.41*jab,-.045*shift-.12*weave+.14*jab))
            chest=bind['Root']+hip+pelvis@(bind['Chest']-bind['Root'])
            neck=chest+torso@(bind['Head']-bind['Chest'])
            for side,sign in [('L',-1),('R',1)]:
                u,l,f=['Thigh'+side,'Shin'+side,'Foot'+side]
                thigh=bind['Root']+hip+pelvis@(bind[u]-bind['Root'])
                # The planted foot travels backwards relative to the moving boxer.
                # Its partner clears the floor, passes it, then takes the weight.
                p=(t+(0 if sign<0 else .5))%1
                swing=max(0.,sin((p-.50)*2*pi)) if p>=.50 else 0
                travel=.25-p if p<.50 else -.25-(p-.5)+ease((p-.5)*2)
                dx,dz=stride.get(name,(0,0))
                foot=bind[f]+ring(dx*travel, (.085*swing if moving else .005*bob),
                                  dz*travel-sign*.103)
                knee=bend(thigh,foot,ring(.12*sign,0,1),(bind[l]-bind[u]).length,(bind[f]-bind[l]).length)
                aim(u,(bind[l]-bind[u]).rotation_difference(knee-thigh))
                aim(l,(bind[f]-bind[l]).rotation_difference(foot-knee))
                aim(f,angles(.18*swing if moving else .025*bob,.11*sign))
                u,l='Drive'+side,'Fore'+side
                shoulder=chest+torso@(bind[u]-bind['Chest'])
                elbow_to_wrist=ring(-sign*.38,.76,.53).normalized()*.267
                # Keep the padded knuckles in front of the moving face on the return, too.
                hand=neck+ring(sign*(.232+.014*shift),-.11+.020*sin(wave+sign),
                               .245-sign*.020+.018*cos(wave+sign))
                if attack and sign==active:
                    hand+=ring(sign*.045,.015,-.019)*load
                    goal=ring(sign*.075,1.54,.62)
                    if name=='LeadArc':
                        goal=ring(-sign*.045,1.54,.44)
                        hand.x+=sign*.19*sin(pi*reach)
                    hand=hand.lerp(goal,reach)
                else:hand+=ring(.018*weave+.028*sign*uppercut,.024*load-.06*uppercut,.023*reach)
                elbow=bend(shoulder,hand,ring(sign*(.65+reach*(1 if name=='LeadArc' else .14)),-1,-.18),
                           (bind[l]-bind[u]).length,elbow_to_wrist.length)
                aim(u,(bind[l]-bind[u]).rotation_difference(elbow-shoulder))
                aim(l,elbow_to_wrist.rotation_difference(hand-elbow))
        anim.action=None
        track=anim.nla_tracks.new();track.name=name
        track.strips.new(name,0,action)
        track.mute=True
    anim.nla_tracks['GuardFootwork'].mute=False
    scene.frame_set(0)
