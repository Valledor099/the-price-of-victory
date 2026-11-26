"""Two-beat boxing stance with a staggered base and counter-rotation of the head."""
from math import cos, sin, pi
from mathutils import Euler, Vector


def animate_guard(rig,scene):
    scene.render.fps=24
    def rotate(name,pitch=0,yaw=0,roll=0):
        bone=rig.pose.bones[name]
        axes=bone.bone.matrix_local.to_quaternion()
        world=Euler((pitch,-roll,yaw),'XYZ').to_quaternion()
        bone.rotation_quaternion=axes.inverted()@world@axes
        bone.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=name)

    for frame in range(1,50,4):
        t=2*pi*(frame-1)/48
        shift=sin(t);bounce=cos(2*t)
        hips=rig.pose.bones['Root']
        move=Vector((.046*shift,-.012*cos(t),-.049-.018*bounce))
        hips.location=hips.bone.matrix_local.to_quaternion().inverted()@move
        hips.keyframe_insert(data_path='location',frame=frame,group='Root')
        rotate('Root',-.025,-.15+.065*shift,.031*shift)
        rotate('Chest',.12+.033*bounce,-.17+.13*sin(t+.37),-.083*shift)
        rotate('Head',-.11,-.12*sin(t+.37)+.30,.065*shift)
        for n,side in enumerate(('L','R')):
            sign=1 if n==0 else -1
            step=sign*cos(t)
            thigh=-.22+sign*.17+.115*step
            shin=.39-sign*.082+.115*bounce
            rotate('Thigh'+side,thigh,.10*sign,-.078*sign-.06*shift)
            rotate('Shin'+side,shin)
            rotate('Foot'+side,-thigh-shin+.045*step)
            rotate('Drive'+side,-.23-.085*step-.035*bounce,sign*.085,.055*shift)
            rotate('Fore'+side,-.18+.10*step,sign*.07,.04*sign)
    rig.animation_data.action.name='GuardFootwork'
    scene.frame_set(1)
