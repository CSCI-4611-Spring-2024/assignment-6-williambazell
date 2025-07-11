/* Assignment 6: A World Made of Drawings
 * Original C++ implementation by UMN CSCI 4611 Instructors, 2018+
 * GopherGfx implementation by Evan Suma Rosenberg <suma@umn.edu>, 2022-2024
 * Refactoring by Daniel Keefe, Fall 2023
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 * PUBLIC DISTRIBUTION OF SOURCE CODE OUTSIDE OF CSCI 4611 IS PROHIBITED
 */ 

import * as gfx from 'gophergfx'
import { Billboard } from './Billboard';

/**
 * This class represents a 2D stroke drawn by the user with the mouse that can be rendered in the
 * 3D scene. The raw input from the mouse in normalized device coordinates is stored in the path2D
 * array. The class automatically builds a triangle mesh around this path, using the path as a
 * centerline and adding two triangles between every pair of points in the path.  The triangle
 * mesh is also defined in normalized device coordinates. 
 */
export class Stroke2D extends gfx.Node3
{
    // PUBLIC MEMBER VARIABLES

    // List of positions that make up the stroke in normalized device coordinates.  Each point is a postion
    // of the mouse as it was moved across the screen. This path is the centerline for the stroke.
    public path: gfx.Vector2[];

    // The vertices of the triangle mesh used to draw the Stroke2D on the screen. Two triangles are created
    // to draw the segment between every pair of positions in the path2D array. The xy values for the vertices
    // are in 2D normalized devices coordinates. The z value is hardcoded to be the smallest possible value
    // for pseudodepth (i.e., just less that -1)
    public vertices: gfx.Vector2[];

    // The indices of the triangle mesh used to draw the Stroke2D on the screen.
    public indices: number[];

    // This determines how thick the stroke should be when drawn with triangles.  The stroke extends half of
    // this width on either side of the path2D.
    public strokeWidth: number;

    // To avoid making a local copy, the color is saved directly in the mesh's material. This is
    // a shortcut to getting the mesh's material color
    public get color(): gfx.Color {
        return this.mesh.material.getColor();
    }

    // To avoid making a local copy, the color is saved directly in the mesh's material. This is
    // a shortcut to setting the mesh's material color
    public set color(col: gfx.Color) {
        this.mesh.material.setColor(col);
    }


    // PRIVATE, IMPLEMENTATION VARIABLES

    // GopherGfx has better support for 3D meshes than 2D. So, this underlying mesh is stored as a Mesh3,
    // but the implementation would be a bit cleaner if it could be a Mesh2.  Improving GopherGfx's Mesh2
    // to support updating indices and two-sided materials should go on the GopherGfx TODO list.
    private mesh: gfx.Mesh3;

    // Mirror of the 2D vertices array but as 3D vertices with z just less than -1.0 because the smallest
    // value for pseudodepth that is not clipped by the near plane is just a bit less than -1.0.
    private vertices3D: gfx.Vector3[];

    
    /**
     * Creates a new, empty Stroke2D.
     *  
     * @param camera The camera parameter is needed to position the Stroke's mesh correctly in the scene.
     * If the camera moves between the time the stroke is created and the time drawing begins, then you 
     * must update this class by calling setCameraParameters(); otherwise, the stroke will not be drawn 
     * in the correct place.
     * @param color Optionally provide a color for the stroke (default white)
     * @param strokeWidth Optionally specify the width for the stroke (default 0.02)
     */
    constructor(camera: gfx.Camera, color = new gfx.Color(), strokeWidth = 0.02)
    {
        super();

        this.strokeWidth = strokeWidth;

        this.path = [];
        this.vertices = [];
        this.indices = [];

        this.mesh = new gfx.Mesh3();
        this.mesh.material = new gfx.UnlitMaterial();
        this.mesh.material.setColor(color);
        this.add(this.mesh);

        this.vertices3D = [];
        this.mesh.setVertices(this.vertices3D);
        this.mesh.setIndices(this.indices);

        this.setCameraParameters(camera);
    }

    
    /**
     * This method is called to add new points to the stroke when the user moves the mouse
     * while drawing on the screen.  If the mouse has moved a sufficient distance (more
     * than half of the width of the stroke) then a new sample is added the the stroke's
     * path and new triangles are added to the stroke's mesh.
     * 
     * @param screenPt The new position of the mouse in normalized device coordinates.
     */
    addPoint(screenPt: gfx.Vector2): void
    {
        if (this.path.length == 0) {

            this.path.push(screenPt);
            this.vertices.push(screenPt);
            this.vertices.push(screenPt);    
            this.vertices3D.push(new gfx.Vector3(screenPt.x, screenPt.y, -0.999));
            this.vertices3D.push(new gfx.Vector3(screenPt.x, screenPt.y, -0.999));    
            return;
        }

        const newPoint = new gfx.Vector2(screenPt.x, screenPt.y);
        const endPoint = this.path[this.path.length-1];

        if (newPoint.distanceTo(endPoint) > this.strokeWidth / 2) {
            const strokeVector = gfx.Vector2.subtract(newPoint, endPoint);
            strokeVector.normalize();
            strokeVector.rotate(Math.PI / 2);
            strokeVector.multiplyScalar(this.strokeWidth/2);

            const vertex1 = gfx.Vector2.subtract(newPoint, strokeVector);
            const vertex2 = gfx.Vector2.add(newPoint, strokeVector);
            
            const nextIndex = this.vertices.length;
            this.vertices.push(vertex1);
            this.vertices.push(vertex2);
            this.vertices3D.push(new gfx.Vector3(vertex1.x, vertex1.y, -0.999));
            this.vertices3D.push(new gfx.Vector3(vertex2.x, vertex2.y, -0.999));

            this.indices.push(nextIndex, nextIndex + 1, nextIndex - 2);
            this.indices.push(nextIndex - 1, nextIndex - 2, nextIndex + 1);

            this.path.push(newPoint);

            this.mesh.setVertices(this.vertices3D);
            this.mesh.setIndices(this.indices);
            this.mesh.createDefaultVertexColors();
        }
    }


    /**
     * This method sets up the 3D scene graph to draw the Mesh3 as if it were a Mesh2, in 
     * other words, interpreting the coordinates of the vertices as normalized device 
     * coordinates given the camera's current position, orientation, and projection.
     *
     * This is called automatically by the constructor.  You should call it again manually
     * if the camera moves after the Stroke2D is created.  In Harold, Stroke2Ds are only
     * used temporarily while the user is actively drawing, and the camera should not
     * be moving while drawing, so it is generally sufficient to just set the camera
     * parameters from within the constructor.
     * 
     * @param camera The camera used when drawing the Stroke2D.
     */
    public setCameraParameters(camera: gfx.Camera): void
    {
        // The strategy is to move this Stroke2D node to match the current position and rotation
        // of the camera. This makes the local coordinate space equivalent to View Space.
        this.position.copy(camera.position);
        this.rotation.copy(camera.rotation);
    
        // In addition, the localToParent matrix of the child mesh is set to the inverse of
        // the camera's projection matrix.  This has the effect of canceling out the projection
        // step of the rendering pipeline, which makes the local coordinate space equivalent to
        // the Canonical View Volume, where the X and Y dimensions match the 2D normalized device
        // coordinates we used when defining the mesh.  Although this is what we want, this
        // approach is not the cleanest, and if we can switch to rendering a Mesh2 rather than
        // a Mesh3 in the future, then this whole setCameraParameters routine would not be
        // needed since the 2D rendering mode already works directly with Normalized Device 
        // Coordinates.
        this.mesh.setLocalToParentMatrix(camera.projectionMatrix.inverse(), false);
    }


    /**
     * Creates and returns a new Mesh3 by projecting the Stroke2D drawn by the user onto a sky sphere
     * of the specified radius.
     * 
     * @param camera The camera used while drawing the stroke. This is used within the routine to
     * create pick rays that originate at the camera's position and pass through the vertices of the
     * stroke2D.
     * @param skyRadius The radius of the sky sphere the stroke is projected onto.
     * @returns A new Mesh3 that holds the projected version of the stroke and can be added to the scene.
     */
    public createSkyStrokeMesh(camera: gfx.Camera, skyRadius: number): gfx.Mesh3
    {
        
        const vertices: gfx.Vector3[] = [];
        const skySphere = new gfx.BoundingSphere();
        skySphere.radius = skyRadius;

        this.vertices.forEach((vertex: gfx.Vector2) => {
            const ray = new gfx.Ray3();
            ray.setPickRay(vertex, camera);
            const intersection = ray.intersectsSphere(skySphere);
            if(intersection){
                vertices.push(intersection);
            } 
        });

        const mesh = new gfx.Mesh3();
        mesh.material = new gfx.UnlitMaterial();
        mesh.material.setColor(this.color);
        mesh.setVertices(vertices);
        mesh.setIndices(this.indices);

        return mesh;
    }


    /** 
     * Creates and returns a new Billboard object by projecting the Stroke2D drawn by the user onto a 3D plane.
     * The plane is defined by a point within the plane (anchorPointWorld) and a normal, which points from the
     * billboard's anchor point to the camera but without any variation in Y since the billboards in Harold are
     * always vertical planes (i.e., with no tilt up or down). 
     * 
     * Note, the Billboard class is just a small wrapper around a Mesh3.  So, the majority of the functionality
     * in this routine relates to projecting the stroke2D onto a plane and creating a new Mesh3 to hold the
     * result.  This new Mesh3 is then wrapped in a new Billboard object.
     * 
     * @param camera The camera used while drawing the stroke. This is used within the routine to
     * create pick rays that originate at the camera's position and pass through the vertices of the
     * stroke2D.
     * @param anchorPointWorld The 3D point on the ground that the billboard should be attached to and
     * rotate around.
     * @returns A new Billboard object that can be added to the scene.
     */
    public createBillboard(camera: gfx.Camera, anchorPointWorld: gfx.Vector3): Billboard
    {
        //Same as cameraPosition = camera.position;
        const cameraPos = camera.localToWorldMatrix.transformPoint(new gfx.Vector3(0, 0, 0));
        const normalVec = gfx.Vector3.subtract(cameraPos, anchorPointWorld);
        normalVec.normalize();
        const plane = new gfx.Plane3(anchorPointWorld, normalVec);
        const vertices: gfx.Vector3[] = [];

        this.vertices.forEach((vertex: gfx.Vector2) => {
            const ray = new gfx.Ray3();
            ray.setPickRay(vertex, camera);
            const intersection = ray.intersectsPlane(plane);
            if(intersection){
                vertices.push(intersection);
            } 
        });

        const mesh = new gfx.Mesh3();
        mesh.material = new gfx.UnlitMaterial();
        mesh.material.setColor(this.color);
        mesh.setVertices(vertices);
        mesh.setIndices(this.indices);

        return new Billboard(anchorPointWorld, normalVec, mesh);
    }
}
